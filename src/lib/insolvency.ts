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
  "NY Arts and Cultural Affairs Law §12.01: proceeds from a consigned work are trust funds for the artist, not subject to claims of the gallery's creditors.";

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
