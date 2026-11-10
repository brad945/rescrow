import type { ActivityKind, Snapshot } from "@/types";
import { timeAgo } from "@/components/ui";

const DOT: Record<ActivityKind, string> = {
  sale_created: "bg-ink",
  payment_received: "bg-gallery",
  hold_locked: "bg-lock",
  payout_sent: "bg-paid",
  sale_cancelled: "bg-danger",
  hold_refunded: "bg-muted",
  agreement_read: "bg-lock",
  reset: "bg-muted",
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
    <ol className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[a.kind]}`}
          />
          <div>
            <p className="leading-snug">{a.message}</p>
            <p className="text-xs text-muted">{timeAgo(a.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
