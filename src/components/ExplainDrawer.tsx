"use client";

import type { Snapshot } from "@/types";
import { explain, METRIC_LABEL, type Metric } from "@/lib/explain";
import { Money, stamp } from "@/components/ui";

/** A side panel listing the records that sum to one balance. */
export function ExplainDrawer({
  snapshot,
  galleryId,
  metric,
  onClose,
}: {
  snapshot: Snapshot;
  galleryId: string;
  metric: Metric;
  onClose: () => void;
}) {
  const rows = explain(snapshot, galleryId, metric);
  const total = rows.reduce((t, r) => t + r.cents, 0);
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/20"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-md overflow-y-auto bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">{METRIC_LABEL[metric]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-[12px] text-muted">
          Every journal entry behind this figure, from the record it posts.
          {metric === "creditors" &&
            " Operating cash at the moment of failure, which the creditors took."}
        </p>
        <ul className="mt-3 divide-y divide-line/60 text-[12px]">
          {rows.map((r, i) => (
            <li
              key={`${r.ref}_${i}`}
              className="flex justify-between gap-3 py-1.5"
            >
              <span>
                {r.label}
                <span className="num block text-[10px] text-faint">
                  {stamp(r.at)}
                </span>
              </span>
              <Money cents={r.cents} signed />
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-2 text-[12px] font-medium text-trust">
          Sums to <Money cents={total} /> ✓
        </p>
      </aside>
    </div>
  );
}
