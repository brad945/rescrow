"use client";

import { useState } from "react";
import { roundingTable } from "@/lib/rounding";
import { Money } from "@/components/ui";

const PRESETS = [
  {
    label: "Salt Study No. 4, Mara's agreement (50%)",
    priceCents: 950_000,
    installments: 3,
    bps: 5000,
    note: "If this seeded work sold in three installments.",
  },
  {
    label: "Illustrative: $24,000.01 in 7 at 47.5%",
    priceCents: 2_400_001,
    installments: 7,
    bps: 4750,
    note: "Illustrative numbers.",
  },
];

/** Running-total rounding against per-payment rounding, cent by cent. */
export function RoundingCheck() {
  const [p, setP] = useState(PRESETS[0]);
  let table: ReturnType<typeof roundingTable> | null = null;
  let problem: string | null = null;
  try {
    table = roundingTable(p.priceCents, p.installments, p.bps);
  } catch (err) {
    problem = (err as Error).message;
  }
  return (
    <section className="rounded-md border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Check the cents</h2>
        <div className="flex gap-1.5 text-[12px]">
          {PRESETS.map((x) => (
            <button
              key={x.label}
              type="button"
              onClick={() => setP(x)}
              className={`rounded border px-2 py-1 ${p.label === x.label ? "border-ink/40 font-medium" : "border-line text-muted"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        {p.note} Each installment&apos;s artist share, two ways: Rescrow&apos;s
        running total, and rounding each payment on its own.
      </p>
      {problem && <p className="mt-2 text-sm text-danger">{problem}</p>}
      {table && (
        <>
          <table className="mt-3 w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-muted">
                <th className="py-1.5 font-medium">Installment</th>
                <th className="py-1.5 text-right font-medium">Amount</th>
                <th className="py-1.5 text-right font-medium">
                  Running total (Rescrow)
                </th>
                <th className="py-1.5 text-right font-medium">
                  Rounded each time
                </th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr
                  key={r.n}
                  className={`border-b border-line/60 ${r.n === table!.firstDriftRow ? "bg-danger/5" : ""}`}
                >
                  <td className="py-1">{r.n}</td>
                  <td className="py-1 text-right">
                    <Money cents={r.amountCents} />
                  </td>
                  <td className="py-1 text-right">
                    <Money cents={r.runningShareCents} />
                  </td>
                  <td className="py-1 text-right">
                    <Money cents={r.naiveShareCents} />
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-1.5">Total</td>
                <td />
                <td className="py-1.5 text-right text-trust">
                  <Money cents={table.runningTotalCents} />
                </td>
                <td
                  className={`py-1.5 text-right ${table.naiveTotalCents === table.exactShareCents ? "" : "text-danger"}`}
                >
                  <Money cents={table.naiveTotalCents} />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-muted">
            The agreement gives the artist exactly{" "}
            <Money cents={table.exactShareCents} />.{" "}
            {table.firstDriftRow === null
              ? "Here both methods agree."
              : (() => {
                  const d = table.naiveTotalCents - table.exactShareCents;
                  if (d === 0) {
                    return `Rounding each payment drifts from row ${table.firstDriftRow}, though by the last row it happens to cancel out.`;
                  }
                  const cents = `${Math.abs(d)} cent${Math.abs(d) === 1 ? "" : "s"}`;
                  return d > 0
                    ? `Rounding each payment pays the artist ${cents} the agreement doesn't give them, taken from the gallery's part (drift from row ${table.firstDriftRow}).`
                    : `Rounding each payment shorts the artist ${cents} (drift from row ${table.firstDriftRow}).`;
                })()}{" "}
            Rescrow uses the running total. On the demo sale both give
            $12,000.00.
          </p>
        </>
      )}
    </section>
  );
}
