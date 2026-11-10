import { describe, expect, it } from "vitest";
import {
  applyTerms,
  cancelSale,
  createSale,
  receivePayment,
  releaseDueHolds,
  type Clock,
} from "@/lib/escrow/engine";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
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

describe("ledgerFor: deadline payouts and cancellations after them", () => {
  it("labels a deadline payout as one, and shows the refund a buyer actually got", () => {
    let t = Date.parse("2026-11-10T15:00:00.000Z");
    let n = 0;
    const clock: Clock = {
      now: () => new Date(t).toISOString(),
      id: (p) => `${p}_l${++n}`,
    };
    let s = applyTerms(
      createSeed(),
      {
        agreementId: "agr_ines",
        terms: FIXTURE_TERMS.agr_ines!,
        source: "fixture",
      },
      clock,
    );
    const created = createSale(
      s,
      { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
      clock,
    );
    s = receivePayment(
      created.snapshot,
      { saleId: created.sale.id },
      clock,
    ).snapshot;
    t += 61 * 86_400_000;
    s = releaseDueHolds(s, clock);
    s = cancelSale(s, { saleId: created.sale.id }, clock).snapshot;

    const rows = ledgerFor(s, "gal_lowline");
    const payout = rows.find(
      (r) => r.kind === "payout" && r.artistId === "art_ines",
    )!;
    expect(payout.description).toBe("Deadline payout from artist trust");
    expect(payout.amountCents).toBe(-400_000);

    // $8,000 paid: Ines keeps her $4,000 (paid at the deadline). The buyer
    // still gets all $8,000 back: the gallery's own $4,000 plus the $4,000 it
    // covers for Ines, both from operating. Nothing comes out of trust.
    const refund = rows.find((r) => r.kind === "refund")!;
    expect(refund.amountCents).toBe(-800_000);
    expect(refund.trustCents).toBe(0);
    expect(refund.operatingCents).toBe(-800_000);
    expect(refund.description).toMatch(/gallery covers/);
  });
});
