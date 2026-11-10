import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/seed";
import { shareOf } from "@/lib/money";
import { createSale, receivePayment, type Clock } from "@/lib/escrow/engine";
import { roundingTable } from "./rounding";

let n = 0;
const clock: Clock = {
  now: () => "2026-11-10T15:00:00.000Z",
  id: (p) => `${p}_r${++n}`,
};

describe("rounding table", () => {
  it("Salt Study No. 4 in three: naive rounding pays a cent the agreement doesn't", () => {
    const t = roundingTable(950_000, 3, 5000);
    expect(t.rows.map((r) => r.amountCents)).toEqual([
      316_667, 316_667, 316_666,
    ]);
    expect(t.runningTotalCents).toBe(475_000);
    expect(t.naiveTotalCents).toBe(475_001);
    expect(t.firstDriftRow).toBe(2);
  });

  it("the illustrative example drifts too; the demo sale doesn't", () => {
    const ill = roundingTable(2_400_001, 7, 4750);
    expect(ill.runningTotalCents).toBe(ill.exactShareCents);
    expect(ill.naiveTotalCents).not.toBe(ill.exactShareCents);
    const demo = roundingTable(2_400_000, 3, 5000);
    expect(demo.runningTotalCents).toBe(1_200_000);
    expect(demo.naiveTotalCents).toBe(1_200_000);
    expect(demo.firstDriftRow).toBeNull();
  });

  it("matches the real engine on the seeded work, row by row", () => {
    // Mara's agreement terms are on file in the seed.
    const { sale, snapshot } = createSale(
      createSeed(),
      { artworkId: "wrk_salt", buyerName: "X", installments: 3 },
      clock,
    );
    let s = snapshot;
    for (let i = 0; i < 3; i++)
      s = receivePayment(s, { saleId: sale.id }, clock).snapshot;
    const holds = s.payments
      .filter((p) => p.saleId === sale.id)
      .map((p) => s.holds.find((h) => h.paymentId === p.id)!.amountCents);
    expect(holds).toEqual(
      roundingTable(950_000, 3, sale.artistShareBps).rows.map(
        (r) => r.runningShareCents,
      ),
    );
  });

  it("property: the running total is always exact and installments sum to the price", () => {
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 2000; i++) {
      const n = 1 + Math.floor(rand() * 24);
      const price = n + Math.floor(rand() * 10_000_000);
      const bps = Math.floor(rand() * 10_001);
      const t = roundingTable(price, n, bps);
      expect(t.runningTotalCents).toBe(shareOf(price, bps));
      expect(t.rows.reduce((a, r) => a + r.amountCents, 0)).toBe(price);
    }
  });

  it("rejects bad input with a message", () => {
    expect(() => roundingTable(100.5, 2, 5000)).toThrow(/whole cents/);
    expect(() => roundingTable(1000, 0, 5000)).toThrow(/1 to 24/);
    expect(() => roundingTable(1000, 2, 10_001)).toThrow(/basis points/);
  });
});
