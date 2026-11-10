import { describe, expect, it } from "vitest";
import {
  cancelSale,
  createSale,
  receivePayment,
  type Clock,
} from "@/lib/escrow/engine";
import { createSeed } from "@/lib/seed";
import { ledgerFor } from "./ledger";

function clock(): Clock {
  let n = 0;
  return {
    now: () => `2026-11-10T12:00:${String(n).padStart(2, "0")}.000Z`,
    id: (p) => `${p}_${++n}`,
  };
}

describe("ledgerFor", () => {
  it("splits each deposit into trust and operating, and shows the payout", () => {
    const c = clock();
    const { snapshot: first, sale } = createSale(
      createSeed(),
      { artworkId: "wrk_salt", buyerName: "J. Park", installments: 1 },
      c,
    );
    const s = receivePayment(first, { saleId: sale.id }, c).snapshot;

    const rows = ledgerFor(s, "gal_lowline");
    const deposit = rows.find((r) => r.counterparty === "J. Park")!;
    expect(deposit.trustCents + deposit.operatingCents).toBe(950_000);
    expect(deposit.trustCents).toBe(475_000);
    const payout = rows.find(
      (r) => r.kind === "payout" && r.counterparty === "Mara Okafor",
    )!;
    expect(payout.amountCents).toBe(-475_000);
  });

  it("nets every row to zero against the account when a sale is cancelled", () => {
    const c = clock();
    const { snapshot: first, sale } = createSale(
      createSeed(),
      { artworkId: "wrk_salt", buyerName: "J. Park", installments: 2 },
      c,
    );
    let s = receivePayment(first, { saleId: sale.id }, c).snapshot;
    s = cancelSale(s, { saleId: sale.id }, c).snapshot;

    const forSale = ledgerFor(s, "gal_lowline").filter(
      (r) => r.counterparty === "J. Park",
    );
    expect(forSale.map((r) => r.kind).sort()).toEqual(["deposit", "refund"]);
    expect(forSale.reduce((t, r) => t + r.amountCents, 0)).toBe(0);
    expect(forSale.reduce((t, r) => t + r.trustCents, 0)).toBe(0);
  });
});
