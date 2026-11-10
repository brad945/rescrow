import type { Snapshot } from "@/types";
import { artistAccount } from "@/lib/escrow/reconcile";
import { Money } from "@/components/ui";

/**
 * One artist's own check, in a sentence: their share of every buyer payment
 * equals what is held, paid and returned, computed from the payments, the
 * trust holds and the separate journal. Says which source disagrees if any.
 */
export function ArtistAccountLine({
  snapshot,
  galleryId,
  artistId,
  className = "",
}: {
  snapshot: Snapshot;
  galleryId: string;
  artistId: string;
  className?: string;
}) {
  const a = artistAccount(snapshot, galleryId, artistId);
  const gallery = snapshot.galleries.find((g) => g.id === galleryId);
  const ok = a.agrees && a.journalAgrees;
  return (
    <p
      className={`text-xs leading-relaxed ${ok ? "text-trust" : "text-danger"} ${className}`}
    >
      Your account at {gallery?.name}: your share of buyer payments{" "}
      <Money cents={a.shareReceivedCents} /> = held{" "}
      <Money cents={a.heldCents} /> + paid to you <Money cents={a.paidCents} />
      {a.refundedCents > 0 && (
        <>
          {" "}
          + returned to buyers <Money cents={a.refundedCents} />
        </>
      )}
      .{" "}
      {ok
        ? "Checked against the payments, the trust holds and the separate journal ✓"
        : !a.agrees
          ? "The payments and the trust holds don't agree."
          : "The journal doesn't agree with the trust holds."}
    </p>
  );
}
