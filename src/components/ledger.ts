import type { Cents, Id, Snapshot } from "@/types";
import { methodLabel } from "@/lib/money";

/** One line in the gallery's account ledger, the way a bank statement reads. */
export interface LedgerRow {
  id: string;
  at: string;
  kind: "deposit" | "payout" | "refund";
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

  for (const po of s.payouts.filter((x) => x.galleryId === galleryId)) {
    rows.push({
      id: po.id,
      at: po.paidAt,
      kind: "payout",
      description: "Same day payout from artist trust",
      counterparty: artistName(po.artistId),
      amountCents: -po.amountCents,
      trustCents: -po.amountCents,
      operatingCents: 0,
      artistId: po.artistId,
    });
  }

  for (const sale of s.sales.filter(
    (x) => x.galleryId === galleryId && x.status === "cancelled",
  )) {
    const refunded = s.holds.filter(
      (h) => h.saleId === sale.id && h.status === "refunded",
    );
    if (refunded.length === 0) continue;
    const paid = s.payments
      .filter((p) => p.saleId === sale.id)
      .reduce((t, p) => t + p.amountCents, 0);
    const trust = refunded.reduce((t, h) => t + h.amountCents, 0);
    rows.push({
      id: `refund_${sale.id}`,
      at: refunded[0].releasedAt ?? sale.createdAt,
      kind: "refund",
      description: "Refund to buyer, sale cancelled",
      counterparty: sale.buyerName,
      amountCents: -paid,
      trustCents: -trust,
      operatingCents: -(paid - trust),
      artistId: sale.artistId,
    });
  }

  return rows.sort((a, b) =>
    a.at === b.at ? order(b) - order(a) : b.at.localeCompare(a.at),
  );
}

// Within the same second, a deposit comes before the payout it triggers.
function order(r: LedgerRow): number {
  return r.kind === "deposit" ? 0 : 1;
}
