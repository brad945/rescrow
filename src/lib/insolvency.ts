// The insolvency ending, and the same failure without a separate account.
//
// The counterfactual assumes the same events in the same order, with the same
// payouts before the failure (a completed sale, or a share already paid on its
// deadline, was paid either way). Only the separate trust account is removed,
// so the single balance an administrator would have frozen is operating plus
// trust at the moment of failure. No rent, payroll or recovery rate is
// invented, and nothing here says what a court would award: without the
// separate account the artists would need a tracing claim; with it, there is
// nothing to trace.
import type { Cents, Id, Snapshot } from "@/types";

export const TRUST_STATUTE =
  "NY Arts and Cultural Affairs Law §12.01: proceeds from a consigned work are trust funds for the artist, not subject to claims of the gallery's creditors, unless the artist waived that in writing (and even then the first $2,500 a year stays protected).";

export interface InsolvencyOutcome {
  toCreditorsCents: Cents;
  toArtists: {
    artistId: Id;
    amountCents: Cents;
    payoutId: Id;
    paidAt: string;
  }[];
  worksReturned: { artworkId: Id; artistId: Id; title: string }[];
  /** Operating plus trust at the failure: one frozen balance without a trust account. */
  commingledCents: Cents;
  /** The artists' part of that balance. */
  artistsShareOfCommingledCents: Cents;
}

export function insolvencyOutcome(
  s: Snapshot,
  galleryId: Id,
): InsolvencyOutcome | null {
  const gallery = s.galleries.find((g) => g.id === galleryId);
  if (!gallery || gallery.status !== "insolvent") return null;
  const toCreditorsCents = gallery.claimedByCreditorsCents ?? 0;
  const toArtists = s.payouts
    .filter((p) => p.galleryId === galleryId && p.reason === "insolvency")
    .map((p) => ({
      artistId: p.artistId,
      amountCents: p.amountCents,
      payoutId: p.id,
      paidAt: p.paidAt,
    }));
  const worksReturned = s.artworks
    .filter((w) => w.galleryId === galleryId && w.status === "returned")
    .map((w) => ({ artworkId: w.id, artistId: w.artistId, title: w.title }));
  const artistsShareOfCommingledCents = toArtists.reduce(
    (t, a) => t + a.amountCents,
    0,
  );
  return {
    toCreditorsCents,
    toArtists,
    worksReturned,
    commingledCents: toCreditorsCents + artistsShareOfCommingledCents,
    artistsShareOfCommingledCents,
  };
}

export interface OpenSaleRow {
  saleId: Id;
  artistId: Id;
  buyerName: string;
  workTitle: string;
  paidCents: Cents;
  /** Artist's share already paid on its agreement deadline, before the failure. */
  paidOnDeadlineCents: Cents;
  /** Artist's share paid out of trust at the failure. */
  paidAtFailureCents: Cents;
  /** The gallery's part of what the buyer paid: the buyer's claim on the estate. */
  buyerClaimCents: Cents;
}

export interface StatementOfAffairs {
  outcome: InsolvencyOutcome;
  /** Paid from trust at the failure, with the bank transactions that funded it. */
  trustPaidOut: {
    artistId: Id;
    amountCents: Cents;
    payoutId: Id;
    paymentIds: Id[];
    bankIds: string[];
  }[];
  openSales: OpenSaleRow[];
  estateCashCents: Cents;
  buyerClaimsCents: Cents;
}

/**
 * The administrator's statement, from the records: what was never part of
 * the estate (trust paid to artists, works returned), the estate (operating
 * cash, buyers' claims), and every open sale's money split by where it went.
 * The split is by each payout's recorded reason, not by date.
 */
export function statementOfAffairs(
  s: Snapshot,
  galleryId: Id,
): StatementOfAffairs | null {
  const outcome = insolvencyOutcome(s, galleryId);
  if (!outcome) return null;
  const payoutOf = (holdId: Id) =>
    s.payouts.find((p) => p.holdIds.includes(holdId));
  const trustPaidOut = outcome.toArtists.map((a) => {
    const payout = s.payouts.find((p) => p.id === a.payoutId)!;
    const payments = payout.holdIds
      .map((h) => s.holds.find((x) => x.id === h)?.paymentId)
      .map((pid) => s.payments.find((p) => p.id === pid))
      .filter((p) => p !== undefined);
    return {
      ...a,
      paymentIds: payments.map((p) => p.id),
      bankIds: payments.map((p) => p.rampTransactionId ?? "").filter(Boolean),
    };
  });
  const openSales = s.sales
    .filter((x) => x.galleryId === galleryId && x.status === "open")
    .map((sale) => {
      const holds = s.holds.filter((h) => h.saleId === sale.id);
      const paidCents = s.payments
        .filter((p) => p.saleId === sale.id)
        .reduce((t, p) => t + p.amountCents, 0);
      const by = (reason: string) =>
        holds
          .filter(
            (h) => h.status === "paid" && payoutOf(h.id)?.reason === reason,
          )
          .reduce((t, h) => t + h.amountCents, 0);
      const artistPart = holds.reduce((t, h) => t + h.amountCents, 0);
      return {
        saleId: sale.id,
        artistId: sale.artistId,
        buyerName: sale.buyerName,
        workTitle:
          s.artworks.find((w) => w.id === sale.artworkId)?.title ??
          sale.artworkId,
        paidCents,
        paidOnDeadlineCents: by("deadline"),
        paidAtFailureCents: by("insolvency"),
        buyerClaimCents: paidCents - artistPart,
      };
    });
  return {
    outcome,
    trustPaidOut,
    openSales,
    estateCashCents: outcome.toCreditorsCents,
    buyerClaimsCents: openSales.reduce((t, r) => t + r.buyerClaimCents, 0),
  };
}

export interface ArtistAtFailure {
  galleryId: Id;
  galleryName: string;
  /** Payouts from trust at the failure, with the buyer payments that funded them. */
  paidAtFailure: StatementOfAffairs["trustPaidOut"];
  /** Shares on still-open sales already paid on their deadline before the failure. */
  paidOnDeadlineBeforeCents: Cents;
  worksReturned: InsolvencyOutcome["worksReturned"];
  /** Works under a sale still open at the failure. */
  worksUnderOpenSale: { saleId: Id; workTitle: string; buyerName: string }[];
}

/** One artist's slice of the statement of affairs, built by filtering it, not recomputing. */
export function artistAtFailure(
  s: Snapshot,
  artistId: Id,
): ArtistAtFailure | null {
  for (const g of s.galleries.filter((x) => x.status === "insolvent")) {
    const st = statementOfAffairs(s, g.id);
    if (!st) continue;
    const mine = st.openSales.filter((r) => r.artistId === artistId);
    const result: ArtistAtFailure = {
      galleryId: g.id,
      galleryName: g.name,
      paidAtFailure: st.trustPaidOut.filter((t) => t.artistId === artistId),
      paidOnDeadlineBeforeCents: mine.reduce(
        (t, r) => t + r.paidOnDeadlineCents,
        0,
      ),
      worksReturned: st.outcome.worksReturned.filter(
        (w) => w.artistId === artistId,
      ),
      worksUnderOpenSale: mine.map((r) => ({
        saleId: r.saleId,
        workTitle: r.workTitle,
        buyerName: r.buyerName,
      })),
    };
    if (
      result.paidAtFailure.length ||
      result.worksReturned.length ||
      result.worksUnderOpenSale.length
    ) {
      return result;
    }
  }
  return null;
}
