// Why Rescrow rounds on the running total, cent by cent.
//
// The installment schedule is the engine's own rule (nextInstallment: the
// remaining balance over the remaining count, rounded up). For each
// installment, the artist's share is computed two ways: Rescrow's running
// total (share of everything paid so far, minus share of what was paid
// before, as artistShareOfPayment does) and the naive per-payment rounding.
// The running total always adds up to exactly the share of the price; the
// naive sum can drift.
import type { Cents } from "@/types";
import { shareOf } from "@/lib/money";

export interface RoundingRow {
  n: number;
  amountCents: Cents;
  runningShareCents: Cents;
  naiveShareCents: Cents;
}

export interface RoundingTable {
  rows: RoundingRow[];
  runningTotalCents: Cents;
  naiveTotalCents: Cents;
  exactShareCents: Cents;
  /** First row where the two columns' running sums differ, or null. */
  firstDriftRow: number | null;
}

export function roundingTable(
  priceCents: Cents,
  installments: number,
  bps: number,
): RoundingTable {
  if (!Number.isInteger(priceCents) || priceCents < installments) {
    throw new Error(
      "Price must be whole cents, at least one cent per installment",
    );
  }
  if (
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > 24
  ) {
    throw new Error("Installments must be 1 to 24");
  }
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error("The split must be 0 to 10,000 basis points");
  }
  const rows: RoundingRow[] = [];
  let paid = 0;
  let naiveSum = 0;
  let firstDriftRow: number | null = null;
  for (let n = 1; n <= installments; n++) {
    const amountCents = Math.ceil((priceCents - paid) / (installments - n + 1));
    const runningShareCents =
      shareOf(paid + amountCents, bps) - shareOf(paid, bps);
    const naiveShareCents = shareOf(amountCents, bps);
    paid += amountCents;
    naiveSum += naiveShareCents;
    if (firstDriftRow === null && naiveSum !== shareOf(paid, bps)) {
      firstDriftRow = n;
    }
    rows.push({ n, amountCents, runningShareCents, naiveShareCents });
  }
  return {
    rows,
    runningTotalCents: rows.reduce((t, r) => t + r.runningShareCents, 0),
    naiveTotalCents: naiveSum,
    exactShareCents: shareOf(priceCents, bps),
    firstDriftRow,
  };
}
