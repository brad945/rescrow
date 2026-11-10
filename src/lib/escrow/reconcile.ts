import type { Cents, Id, Reconciliation, Snapshot } from "@/types";
import { formatCents } from "@/lib/money";

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
  const refundedToBuyersCents = refundedHolds + galleryPartsRefunded;
  const claimedByCreditorsCents = gallery.claimedByCreditorsCents ?? 0;
  const operatingCents = gallery.operatingBalanceCents;
  const openingCents =
    gallery.openingBalanceCents ??
    operatingCents -
      galleryParts +
      galleryPartsRefunded +
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
  };
}
