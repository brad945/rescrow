import type { ActivityKind, Snapshot } from "@/types";
import { stamp } from "@/components/ui";

// Partial so new activity kinds from the backend fall back to "Event" instead of breaking the build.
const LABEL: Partial<Record<ActivityKind, string>> = {
  sale_created: "Sale",
  payment_received: "Deposit",
  hold_locked: "Held",
  payout_sent: "Payout",
  sale_cancelled: "Cancelled",
  hold_refunded: "Refund",
  agreement_read: "Agent",
  reset: "Reset",
};

export function ActivityFeed({
  snapshot,
  artistId,
  limit = 10,
}: {
  snapshot: Snapshot;
  artistId?: string;
  limit?: number;
}) {
  const items = snapshot.activity
    .filter((a) => !artistId || a.artistId === artistId)
    .slice(0, limit);
  if (items.length === 0) {
    return <p className="text-sm text-muted">Nothing yet.</p>;
  }
  return (
    <ol className="divide-y divide-line">
      {items.map((a) => (
        <li
          key={a.id}
          className="grid grid-cols-[64px_1fr] gap-2 py-2 text-[13px]"
        >
          <span
            className={`pt-px text-[11px] font-medium ${a.kind === "hold_locked" || a.kind === "payout_sent" ? "text-trust" : "text-muted"}`}
          >
            {LABEL[a.kind] ?? "Event"}
          </span>
          <div>
            <p className="leading-snug">{a.message}</p>
            <p className="num text-[11px] text-faint">{stamp(a.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
