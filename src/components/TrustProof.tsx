import type { Snapshot } from "@/types";
import { reconcile } from "@/lib/escrow/reconcile";
import { Money } from "@/components/ui";

const GALLERY = "gal_lowline";

/**
 * One strip above the gallery's balances: proof the books balance to the cent,
 * and, once the gallery fails, what creditors got and what the artists got.
 */
export function TrustProof({ snapshot }: { snapshot: Snapshot }) {
  const gallery = snapshot.galleries.find((g) => g.id === GALLERY);
  if (!gallery) return null;
  const r = reconcile(snapshot, GALLERY);
  const insolvent = gallery.status === "insolvent";
  const returned = snapshot.artworks.filter(
    (w) => w.galleryId === GALLERY && w.status === "returned",
  ).length;

  return (
    <div className="space-y-2">
      {insolvent && (
        <div className="slide-in rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
          <p className="font-semibold text-danger">
            {gallery.name} is insolvent
          </p>
          <p className="mt-0.5 text-ink/80">
            Creditors took <Money cents={r.claimedByCreditorsCents} /> of
            operating cash. Every dollar in artist trust was paid to the artists
            instead. It was never the gallery&apos;s to lose.
            {returned > 0 && (
              <>
                {" "}
                {returned === 1
                  ? "The one unsold consigned work went"
                  : `All ${returned} unsold consigned works went`}{" "}
                back to the artists, too.
              </>
            )}
          </p>
        </div>
      )}
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-4 py-2 text-[12px] ${r.balanced ? "border-trust/30 bg-trust-soft text-trust" : "border-danger/30 bg-danger/5 text-danger"}`}
        title={r.breaks.join("\n")}
      >
        <span className="font-medium">
          {r.balanced ? "Books balance to the cent ✓" : "Books don't balance"}
        </span>
        <span className="num text-ink/70">
          In <Money cents={r.openingCents + r.receivedCents} /> = operating{" "}
          <Money cents={r.operatingCents} /> + trust{" "}
          <Money cents={r.trustCents} /> + paid to artists{" "}
          <Money cents={r.paidToArtistsCents} />
          {r.refundedToBuyersCents > 0 && (
            <>
              {" "}
              + refunded <Money cents={r.refundedToBuyersCents} />
            </>
          )}
          {r.claimedByCreditorsCents > 0 && (
            <>
              {" "}
              + creditors <Money cents={r.claimedByCreditorsCents} />
            </>
          )}
        </span>
      </div>
    </div>
  );
}
