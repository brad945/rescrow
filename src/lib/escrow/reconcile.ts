import type { Cents, Id, Reconciliation, Snapshot } from "@/types";
import { formatCents, shareOf } from "@/lib/money";
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

  // Completeness against the bank feed: every payment carries the feed's
  // transaction id, and no id was booked twice.
  const ids = new Map<string, number>();
  for (const p of payments) {
    if (!p.rampTransactionId) {
      breaks.push(`Payment ${p.id} has no bank transaction id`);
    } else {
      ids.set(p.rampTransactionId, (ids.get(p.rampTransactionId) ?? 0) + 1);
    }
  }
  for (const [id, n] of ids) {
    if (n > 1) breaks.push(`Bank transaction ${id} was booked ${n} times`);
  }

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
  // A hold can only be refunded to the buyer as part of cancelling its sale.
  for (const h of holds.filter((x) => x.status === "refunded")) {
    if (!cancelled.has(h.saleId)) {
      breaks.push(
        `Hold ${h.id} was refunded but its sale ${h.saleId} was never cancelled`,
      );
    }
  }
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

  breaks.push(...subLedgerBreaks(s, galleryId));
  breaks.push(...sealBreaks(s, galleryId));
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

/**
 * Totals can balance while single records are wrong (a cent moved from one
 * hold to the next keeps every total intact). These checks reconcile each
 * payment, hold, sale and payout on its own.
 */
function subLedgerBreaks(s: Snapshot, galleryId: Id): string[] {
  const out: string[] = [];
  const sales = s.sales.filter((x) => x.galleryId === galleryId);
  const failed =
    s.galleries.find((g) => g.id === galleryId)?.status === "insolvent";

  for (const sale of sales) {
    // Payments in the order they were recorded (the order the running-total
    // rounding used), not by timestamp, which can tie.
    const payments = s.payments.filter((p) => p.saleId === sale.id);
    let before = 0;
    payments.forEach((p, i) => {
      const own = s.holds.filter((h) => h.paymentId === p.id);
      const after = before + p.amountCents;
      if (own.length === 1) {
        const want =
          shareOf(after, sale.artistShareBps) -
          shareOf(before, sale.artistShareBps);
        if (own[0].amountCents !== want) {
          out.push(
            `Payment ${i + 1} on ${sale.id} put ${formatCents(own[0].amountCents)} in trust; its running-total share is ${formatCents(want)}`,
          );
        }
      }
      before = after;
    });

    const locked = s.holds.filter(
      (h) => h.saleId === sale.id && h.status === "locked",
    );
    if (locked.length > 0 && (sale.status !== "open" || failed)) {
      out.push(
        `${formatCents(locked.reduce((t, h) => t + h.amountCents, 0))} is still locked in trust on ${sale.status} sale ${sale.id}${failed ? " at an insolvent gallery" : ""}`,
      );
    }
  }

  for (const h of s.holds.filter((x) => x.galleryId === galleryId)) {
    const sale = s.sales.find((x) => x.id === h.saleId);
    const payment = s.payments.find((p) => p.id === h.paymentId);
    if (
      !sale ||
      sale.artistId !== h.artistId ||
      sale.galleryId !== h.galleryId
    ) {
      out.push(`Hold ${h.id} doesn't match its sale's artist or gallery`);
    }
    if (payment && payment.saleId !== h.saleId) {
      out.push(`Hold ${h.id} and its payment belong to different sales`);
    }
  }

  for (const po of s.payouts.filter((x) => x.galleryId === galleryId)) {
    const holds = po.holdIds.map((id) => s.holds.find((h) => h.id === id));
    if (holds.some((h) => !h || h.status !== "paid")) {
      out.push(`Payout ${po.id} names a hold that isn't paid`);
      continue;
    }
    if (
      holds.some(
        (h) => h!.artistId !== po.artistId || h!.galleryId !== po.galleryId,
      )
    ) {
      out.push(
        `Payout ${po.id} pays ${po.artistId} from another artist's hold`,
      );
    }
    const total = holds.reduce((t, h) => t + h!.amountCents, 0);
    if (total !== po.amountCents) {
      out.push(
        `Payout ${po.id} is ${formatCents(po.amountCents)} but its holds total ${formatCents(total)}`,
      );
    }
  }
  return out;
}

export interface ArtistAccount {
  /** The artist's share of every buyer payment, computed from the payments. */
  shareReceivedCents: Cents;
  heldCents: Cents;
  paidCents: Cents;
  refundedCents: Cents;
  /** share received = held + paid + refunded, from payments vs holds. */
  agrees: boolean;
  /** The journal says the same: trust balance = held, paid out = payouts. */
  journalAgrees: boolean;
}

/**
 * One artist's own account at one gallery, checked from three sources: the
 * buyer payments, the trust holds, and the separate journal.
 */
export function artistAccount(
  s: Snapshot,
  galleryId: Id,
  artistId: Id,
): ArtistAccount {
  const sales = s.sales.filter(
    (x) => x.galleryId === galleryId && x.artistId === artistId,
  );
  const shareReceivedCents = sales.reduce(
    (t, sale) =>
      t +
      shareOf(
        s.payments
          .filter((p) => p.saleId === sale.id)
          .reduce((a, p) => a + p.amountCents, 0),
        sale.artistShareBps,
      ),
    0,
  );
  const holds = s.holds.filter(
    (h) => h.galleryId === galleryId && h.artistId === artistId,
  );
  const by = (status: string) =>
    holds
      .filter((h) => h.status === status)
      .reduce((t, h) => t + h.amountCents, 0);
  const heldCents = by("locked");
  const paidCents = by("paid");
  const refundedCents = by("refunded");
  const bal = balancesOf(s.journal);
  const payouts = s.payouts
    .filter((p) => p.galleryId === galleryId && p.artistId === artistId)
    .reduce((t, p) => t + p.amountCents, 0);
  return {
    shareReceivedCents,
    heldCents,
    paidCents,
    refundedCents,
    agrees: shareReceivedCents === heldCents + paidCents + refundedCents,
    journalAgrees:
      (bal.get(acct.trust(galleryId, artistId)) ?? 0) === heldCents &&
      (bal.get(acct.artist(galleryId, artistId)) ?? 0) === payouts,
  };
}

/**
 * Each closed month must still hold exactly the journal entries it was
 * sealed with. This catches any later edit, deletion or insertion that
 * didn't also rewrite the close record (whoever controls the data file could
 * rewrite both; a hash would have the same limit).
 */
function sealBreaks(s: Snapshot, galleryId: Id): string[] {
  const out: string[] = [];
  for (const c of (s.closedPeriods ?? []).filter(
    (x) => x.galleryId === galleryId,
  )) {
    const entries = s.journal.filter(
      (e) =>
        e.at <= c.through &&
        e.postings.some((p) => p.account.split(":")[1] === galleryId),
    );
    const totals: Record<string, Cents> = {};
    for (const e of entries) {
      for (const p of e.postings) {
        if (p.account.split(":")[1] !== galleryId) continue;
        totals[p.account] = (totals[p.account] ?? 0) + p.cents;
      }
    }
    const changed = [
      ...new Set([...Object.keys(totals), ...Object.keys(c.totals)]),
    ].filter((a) => (totals[a] ?? 0) !== (c.totals[a] ?? 0));
    if (entries.length !== c.entryCount || changed.length > 0) {
      out.push(
        `Books closed for ${c.month} with ${c.entryCount} entries; the journal now shows ${entries.length}${changed.length ? `, and ${changed.join(", ")} changed` : ""}`,
      );
    }
  }
  return out;
}
