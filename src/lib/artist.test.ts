import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import {
  advanceClock,
  applyTerms,
  cancelSale,
  createSale,
  declareInsolvency,
  receivePayment,
  type Clock,
} from "@/lib/escrow/engine";
import { artistPayments, calendarDays, paymentScorecard } from "./artist";

const INES = "art_ines";

function clock(stepMs = 0): Clock {
  let t = Date.parse("2026-11-10T15:00:00.000Z");
  let n = 0;
  return {
    now: () => {
      const at = new Date(t).toISOString();
      t += stepMs;
      return at;
    },
    id: (p) => `${p}_a${++n}`,
  };
}

function sold(c: Clock) {
  const s = applyTerms(
    createSeed(),
    {
      agreementId: "agr_ines",
      terms: FIXTURE_TERMS.agr_ines!,
      source: "fixture",
    },
    c,
  );
  return createSale(
    s,
    { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
    c,
  );
}

function pay(s: Snapshot, saleId: string, n: number, c: Clock) {
  return receivePayment(
    s,
    { saleId, rampTransactionId: `rtx_${saleId}_${n}` },
    c,
  ).snapshot;
}

describe("artist payment timeline", () => {
  for (const stepMs of [0, 3_000]) {
    it(`happy path (clock step ${stepMs}ms): three rows with the bank ids, paid 60 days early`, () => {
      const c = clock(stepMs);
      const { sale, snapshot } = sold(c);
      let s = snapshot;
      for (const n of [1, 2, 3]) s = pay(s, sale.id, n, c);
      const rows = artistPayments(s, INES);
      expect(rows.map((r) => r.rampTransactionId).sort()).toEqual(
        [1, 2, 3].map((n) => `rtx_${sale.id}_${n}`),
      );
      for (const r of rows) {
        expect(r.summary).toBe(
          "Paid when the sale completed, 60 days before the deadline",
        );
      }
      expect(paymentScorecard(s, INES).line).toBe(
        "3 shares paid when the sale completed, all before the deadline",
      );
    });
  }

  it("after a clock jump: the first share was paid on its deadline", () => {
    const c = clock();
    const { sale, snapshot } = sold(c);
    let s = pay(snapshot, sale.id, 1, c);
    s = advanceClock(s, { days: 61 }, c);
    s = pay(s, sale.id, 2, { ...c, now: () => "2027-01-11T15:00:00.000Z" });
    s = pay(s, sale.id, 3, { ...c, now: () => "2027-01-11T15:00:01.000Z" });
    const first = artistPayments(s, INES).find((r) => r.installment === 1)!;
    expect(first.how).toBe("deadline");
    expect(first.paidAt).toBe(first.dueBy);
    expect(first.summary).toMatch(/^Paid on its deadline, Jan 9, 2027/);
    expect(paymentScorecard(s, INES)).toMatchObject({
      deadline: 1,
      completion: 2,
    });
  });

  it("after insolvency: paid out of trust, no day count, counted apart", () => {
    const c = clock();
    const { sale, snapshot } = sold(c);
    let s = pay(pay(snapshot, sale.id, 1, c), sale.id, 2, c);
    s = declareInsolvency(s, { galleryId: "gal_lowline" }, c).snapshot;
    for (const artist of [INES, "art_theo"]) {
      for (const r of artistPayments(s, artist)) {
        expect(r.how).toBe("insolvency");
        expect(r.daysBeforeDeadline).toBeNull();
      }
    }
    expect(paymentScorecard(s, INES)).toMatchObject({
      insolvency: 2,
      completion: 0,
    });
  });

  it("a cancelled sale's share reads as returned and isn't scored as paid", () => {
    const c = clock();
    const { sale, snapshot } = sold(c);
    const s = cancelSale(
      pay(snapshot, sale.id, 1, c),
      { saleId: sale.id },
      c,
    ).snapshot;
    expect(artistPayments(s, INES)[0].summary).toMatch(
      /^Returned to the buyer/,
    );
    expect(paymentScorecard(s, INES)).toMatchObject({
      returned: 1,
      completion: 0,
    });
  });

  it("Mara's seeded share has no deadline on record and doesn't throw", () => {
    const [row] = artistPayments(createSeed(), "art_mara");
    expect(row.summary).toBe(
      "Paid when the sale completed (no deadline on record)",
    );
  });

  it("counts calendar days, not 24-hour blocks", () => {
    expect(
      calendarDays("2026-11-10T23:59:59.000Z", "2026-11-11T00:00:01.000Z"),
    ).toBe(1);
    expect(
      calendarDays("2026-11-10T15:00:00.000Z", "2027-01-09T15:00:00.000Z"),
    ).toBe(60);
  });
});
