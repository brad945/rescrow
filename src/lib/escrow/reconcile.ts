import type { Cents, Id, Reconciliation, Snapshot } from "@/types";
import { formatCents } from "@/lib/money";
import { acct, balancesOf } from "./journal";

/**
 * Proves every cent that reached the gallery is in exactly one place:
 *
 *   opening + received = operating + trust + paid to artists
 *                        + refunded to buyers + claimed by creditors
 *
 * Also checks each piece against the records it comes from, so a balance
 * edited by hand or a payout without its holds shows up as a named break.
 */
export function reconcile(s: Snapshot, galleryId: Id): Reconciliation {
  const breaks: string[] = [];
  const gallery = s.galleries.find((g) => g.id === galleryId);
  if (!gallery) {
    return {
      balanced: false,
      openingCents: 0,
      receivedCents: 0,
      operatingCents: 0,
      trustCents: 0,
      paidToArtistsCents: 0,
      refundedToBuyersCents: 0,
      claimedByCreditorsCents: 0,
      breaks: [`Gallery ${galleryId} not found`],
    };
  }

  const sum = (xs: { amountCents: Cents }[]) =>
    xs.reduce((t, x) => t + x.amountCents, 0);
  const payments = s.payments.filter((p) => p.galleryId === galleryId);
  const holds = s.holds.filter((h) => h.galleryId === galleryId);
  const cancelled = new Set(
    s.sales.filter((x) => x.status === "cancelled").map((x) => x.id),
  );

  let galleryParts = 0;
  let galleryPartsRefunded = 0;
  for (const p of payments) {
    const own = holds.filter((h) => h.paymentId === p.id);
    if (own.length !== 1) {
      breaks.push(`Payment ${p.id} has ${own.length} trust holds, expected 1`);
      continue;
    }
    const part = p.amountCents - own[0].amountCents;
    if (part < 0) {
      breaks.push(`Payment ${p.id} put more in trust than was received`);
    }
    galleryParts += part;
    if (cancelled.has(p.saleId)) galleryPartsRefunded += part;
  }

  const receivedCents = sum(payments);
  const trustCents = sum(holds.filter((h) => h.status === "locked"));
  const paidHolds = sum(holds.filter((h) => h.status === "paid"));
  const refundedHolds = sum(holds.filter((h) => h.status === "refunded"));
  const payouts = s.payouts.filter((p) => p.galleryId === galleryId);
  const paidToArtistsCents = sum(payouts);
  // Refund records: each cancelled sale has one, and it must give the buyer
  // back exactly what they paid, with its trust part matching the holds.
  const refunds = s.refunds.filter((r) => r.galleryId === galleryId);
  const coveredCents = sum(
    refunds.map((r) => ({ amountCents: r.coveredByGalleryCents })),
  );
  for (const saleId of cancelled) {
    const sale = s.sales.find((x) => x.id === saleId)!;
    if (sale.galleryId !== galleryId) continue;
    const mine = refunds.filter((r) => r.saleId === saleId);
    if (mine.length !== 1) {
      breaks.push(
        `Cancelled sale ${saleId} has ${mine.length} refund records, expected 1`,
      );
      continue;
    }
    const r = mine[0];
    const paidIn = sum(payments.filter((p) => p.saleId === saleId));
    const back =
      r.fromTrustCents + r.fromOperatingCents + r.coveredByGalleryCents;
    if (back !== paidIn) {
      breaks.push(
        `Buyer of ${saleId} paid ${formatCents(paidIn)} but was refunded ${formatCents(back)}`,
      );
    }
    const trustBack = sum(
      holds.filter((h) => h.saleId === saleId && h.status === "refunded"),
    );
    if (trustBack !== r.fromTrustCents) {
      breaks.push(
        `Refund ${r.id} says ${formatCents(r.fromTrustCents)} came from trust, but refunded holds total ${formatCents(trustBack)}`,
      );
    }
    const kept = sum(
      holds.filter((h) => h.saleId === saleId && h.status === "paid"),
    );
    if (kept !== r.coveredByGalleryCents) {
      breaks.push(
        `Refund ${r.id} covers ${formatCents(r.coveredByGalleryCents)} for shares the artist kept, but those total ${formatCents(kept)}`,
      );
    }
  }
  const refundedToBuyersCents =
    refundedHolds + galleryPartsRefunded + coveredCents;
  const claimedByCreditorsCents = gallery.claimedByCreditorsCents ?? 0;
  const operatingCents = gallery.operatingBalanceCents;
  // Without a recorded opening balance the operating check would be true by
  // construction (the opening would be derived from operating itself), so a
  // missing opening is a break of its own, not a silent pass.
  if (gallery.openingBalanceCents === undefined) {
    breaks.push(
      "No opening balance on record, so the operating balance can't be checked",
    );
  }
  const openingCents =
    gallery.openingBalanceCents ??
    operatingCents -
      galleryParts +
      galleryPartsRefunded +
      coveredCents +
      claimedByCreditorsCents;

  if (paidToArtistsCents !== paidHolds) {
    breaks.push(
      `Payouts total ${formatCents(paidToArtistsCents)} but paid trust holds total ${formatCents(paidHolds)}`,
    );
  }
  const paidIds = payouts.flatMap((p) => p.holdIds);
  if (new Set(paidIds).size !== paidIds.length) {
    breaks.push("A trust hold appears in more than one payout");
  }
  const expectedOperating =
    openingCents +
    galleryParts -
    galleryPartsRefunded -
    coveredCents -
    claimedByCreditorsCents;
  if (operatingCents !== expectedOperating) {
    breaks.push(
      `Operating balance is ${formatCents(operatingCents)} but the records add up to ${formatCents(expectedOperating)}`,
    );
  }
  if (operatingCents < 0) breaks.push("Operating balance is negative");

  const inflow = openingCents + receivedCents;
  const outflow =
    operatingCents +
    trustCents +
    paidToArtistsCents +
    refundedToBuyersCents +
    claimedByCreditorsCents;
  if (inflow !== outflow) {
    breaks.push(
      `${formatCents(inflow)} came in but ${formatCents(outflow)} is accounted for`,
    );
  }

  breaks.push(
    ...journalBreaks(s, galleryId, {
      openingCents: gallery.openingBalanceCents,
      operatingCents,
      receivedCents,
      paidToArtistsCents,
      refundedToBuyersCents,
      claimedByCreditorsCents,
    }),
  );

  return {
    balanced: breaks.length === 0,
    openingCents,
    receivedCents,
    operatingCents,
    trustCents,
    paidToArtistsCents,
    refundedToBuyersCents,
    claimedByCreditorsCents,
    breaks,
    journalEntries: s.journal.length,
  };
}

/**
 * The journal is a second, independent record of every move. Fold it and
 * check each balance against the engine's records, to the cent.
 */
function journalBreaks(
  s: Snapshot,
  galleryId: Id,
  r: {
    openingCents: Cents | undefined;
    operatingCents: Cents;
    receivedCents: Cents;
    paidToArtistsCents: Cents;
    refundedToBuyersCents: Cents;
    claimedByCreditorsCents: Cents;
  },
): string[] {
  const out: string[] = [];
  for (const e of s.journal) {
    const sum = e.postings.reduce((t, p) => t + p.cents, 0);
    if (sum !== 0) out.push(`Journal entry ${e.id} sums to ${sum}, not zero`);
  }
  const bal = balancesOf(s.journal);
  const sumKind = (kind: string) =>
    [...bal]
      .filter(([a]) => a.startsWith(`${kind}:${galleryId}:`))
      .reduce((t, [, c]) => t + c, 0);
  const check = (what: string, journal: Cents, records: Cents) => {
    if (journal !== records) {
      out.push(
        `Journal ${what} is ${formatCents(journal)} but the records say ${formatCents(records)}`,
      );
    }
  };
  check("operating", bal.get(acct.operating(galleryId)) ?? 0, r.operatingCents);
  if (r.openingCents !== undefined) {
    check("opening", -(bal.get(acct.equity(galleryId)) ?? 0), r.openingCents);
  }
  check("paid to artists", sumKind("artist"), r.paidToArtistsCents);
  check(
    "creditors",
    bal.get(acct.creditors(galleryId)) ?? 0,
    r.claimedByCreditorsCents,
  );
  check(
    "received from buyers, less refunds",
    -sumKind("buyer"),
    r.receivedCents - r.refundedToBuyersCents,
  );
  // Per artist: the trust account equals that artist's locked holds here.
  const artists = new Set([
    ...s.holds.filter((h) => h.galleryId === galleryId).map((h) => h.artistId),
    ...[...bal.keys()]
      .filter((a) => a.startsWith(`trust:${galleryId}:`))
      .map((a) => a.split(":")[2]),
  ]);
  for (const a of artists) {
    const locked = s.holds
      .filter(
        (h) =>
          h.galleryId === galleryId &&
          h.artistId === a &&
          h.status === "locked",
      )
      .reduce((t, h) => t + h.amountCents, 0);
    check(`trust for ${a}`, bal.get(acct.trust(galleryId, a)) ?? 0, locked);
  }
  return out;
}
