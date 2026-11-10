import type { Cents, Id, Payout, Snapshot } from "@/types";
import { methodLabel } from "@/lib/money";

/** One line in the gallery's account ledger, the way a bank statement reads. */
export interface LedgerRow {
  id: string;
  at: string;
  kind: "deposit" | "payout" | "refund" | "claim";
  description: string;
  counterparty: string;
  amountCents: Cents;
  /** Portion routed to (positive) or out of (negative) the artist trust. */
  trustCents: Cents;
  /** Portion routed to (positive) or out of (negative) operating cash. */
  operatingCents: Cents;
  artistId: Id;
}

/** Rebuilds the account ledger from payments, payouts, and refunds, newest first. */
export function ledgerFor(s: Snapshot, galleryId: Id): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const artistName = (id: Id) =>
    s.artists.find((a) => a.id === id)?.name ?? "Artist";

  for (const p of s.payments.filter((x) => x.galleryId === galleryId)) {
    const sale = s.sales.find((x) => x.id === p.saleId);
    const work = s.artworks.find((w) => w.id === sale?.artworkId);
    const hold = s.holds.find((h) => h.paymentId === p.id);
    const trust = hold?.amountCents ?? 0;
    rows.push({
      id: p.id,
      at: p.receivedAt,
      kind: "deposit",
      description: `${methodLabel(p.method)} in, ${work?.title ?? "sale"}`,
      counterparty: sale?.buyerName ?? "Buyer",
      amountCents: p.amountCents,
      trustCents: trust,
      operatingCents: p.amountCents - trust,
      artistId: sale?.artistId ?? "",
    });
  }

  const failedAt = s.galleries.find((g) => g.id === galleryId)?.insolventAt;
  for (const po of s.payouts.filter((x) => x.galleryId === galleryId)) {
    rows.push({
      id: po.id,
      at: po.paidAt,
      kind: "payout",
      description: payoutLabel(po.reason, failedAt, po.paidAt),
      counterparty: artistName(po.artistId),
      amountCents: -po.amountCents,
      trustCents: -po.amountCents,
      operatingCents: 0,
      artistId: po.artistId,
    });
  }

  // One row per refund record: the artist's locked share comes back out of
  // trust; the gallery's part, and any share the artist already received on
  // its deadline, come out of operating.
  for (const r of s.refunds.filter((x) => x.galleryId === galleryId)) {
    const sale = s.sales.find((x) => x.id === r.saleId);
    const fromOperating = r.fromOperatingCents + r.coveredByGalleryCents;
    rows.push({
      id: r.id,
      at: r.at,
      kind: "refund",
      description:
        r.coveredByGalleryCents > 0
          ? "Refund to buyer, sale cancelled (gallery covers the share already paid to the artist)"
          : "Refund to buyer, sale cancelled",
      counterparty: r.buyerName,
      amountCents: 0 - (r.fromTrustCents + fromOperating),
      trustCents: 0 - r.fromTrustCents,
      operatingCents: 0 - fromOperating,
      artistId: sale?.artistId ?? "",
    });
  }

  // Insolvency: creditors take the operating cash, never the trust.
  const gallery = s.galleries.find((g) => g.id === galleryId);
  if (gallery?.status === "insolvent" && gallery.claimedByCreditorsCents) {
    rows.push({
      id: `claim_${galleryId}`,
      at: gallery.insolventAt ?? "",
      kind: "claim",
      description: "Seized by creditors, gallery insolvent",
      counterparty: "Administrator",
      amountCents: -gallery.claimedByCreditorsCents,
      trustCents: 0,
      operatingCents: -gallery.claimedByCreditorsCents,
      artistId: "",
    });
  }

  return rows.sort((a, b) =>
    a.at === b.at ? order(b) - order(a) : b.at.localeCompare(a.at),
  );
}

function payoutLabel(
  reason: Payout["reason"],
  failedAt: string | null | undefined,
  paidAt: string,
): string {
  if (reason === "deadline") return "Deadline payout from artist trust";
  if (reason === "insolvency" || (failedAt && paidAt >= failedAt)) {
    return "Paid out of trust, gallery insolvent";
  }
  return "Same day payout from artist trust";
}

// Within the same second, a deposit comes before the payout it triggers.
function order(r: LedgerRow): number {
  return r.kind === "deposit" ? 0 : 1;
}
