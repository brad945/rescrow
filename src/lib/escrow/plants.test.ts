import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import {
  advanceClock,
  applyTerms,
  attemptTrustMove,
  cancelSale,
  closePeriod,
  createSale,
  declareInsolvency,
  receivePayment,
  type Clock,
} from "./engine";
import { breakOnCopy, PLANT_INFO } from "./plants";

const G = "gal_lowline";
let n = 0;
const clock: Clock = {
  now: () => "2026-11-10T15:00:00.000Z",
  id: (p) => `${p}_k${++n}`,
};

/** The demo's states: reset, each →, G, D-like redelivery, T, C, B, and a closed month. */
function demoStates(): [string, Snapshot][] {
  const out: [string, Snapshot][] = [];
  let s = createSeed();
  out.push(["reset", s]);
  s = applyTerms(
    s,
    {
      agreementId: "agr_ines",
      terms: FIXTURE_TERMS.agr_ines!,
      source: "fixture",
    },
    clock,
  );
  out.push(["agreement read", s]);
  const { sale, snapshot } = createSale(
    s,
    { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
    clock,
  );
  out.push(["sale", (s = snapshot)]);
  s = receivePayment(
    s,
    { saleId: sale.id, rampTransactionId: "rtx_1" },
    clock,
  ).snapshot;
  out.push(["payment 1", s]);
  s = receivePayment(
    s,
    { saleId: sale.id, rampTransactionId: "rtx_2" },
    clock,
  ).snapshot;
  out.push(["payment 2", s]);
  out.push([
    "G",
    attemptTrustMove(s, { saleId: sale.id, kind: "rent" }, clock).snapshot,
  ]);
  out.push([
    "D",
    receivePayment(s, { saleId: sale.id, rampTransactionId: "rtx_2" }, clock)
      .snapshot,
  ]);
  out.push([
    "closed October",
    closePeriod(s, { galleryId: G, month: "2026-10" }, clock).snapshot,
  ]);
  out.push(["T", advanceClock(s, { days: 61 }, clock)]);
  out.push(["C", cancelSale(s, { saleId: sale.id }, clock).snapshot]);
  out.push(["B", declareInsolvency(s, { galleryId: G }, clock).snapshot]);
  return out;
}

describe("try to break the books", () => {
  const states = demoStates();

  it("every applicable plant is caught in every demo state, and the input is untouched", () => {
    for (const [name, s] of states) {
      const before = structuredClone(s);
      for (const p of PLANT_INFO) {
        const r = breakOnCopy(s, G, p.id);
        if (p.when(s, G)) {
          expect(r.after, `${p.id} in ${name}`).toBeNull();
          continue;
        }
        expect(r.error, `${p.id} in ${name}`).toBeNull();
        expect(r.before.balanced, `${name} starts balanced`).toBe(true);
        expect(
          r.caught,
          `${p.id} in ${name}: ${r.after?.breaks.join(" | ")}`,
        ).toBe(true);
      }
      expect(s).toEqual(before);
    }
  });

  it("every plant applies in at least one demo state", () => {
    for (const p of PLANT_INFO) {
      expect(
        states.some(([, s]) => p.when(s, G) === null),
        `${p.id} never applies`,
      ).toBe(true);
    }
  });

  it("the cent shift is the one no total catches", () => {
    const s = states.find(([n]) => n === "payment 2")![1];
    const r = breakOnCopy(s, G, "shift-cent");
    // Every break is about a single record; no total-level check fires.
    expect(r.after!.breaks.length).toBeGreaterThan(0);
    for (const b of r.after!.breaks) {
      expect(b).toMatch(/running-total share|doesn't match payment/);
      expect(b).not.toMatch(/came in but|Operating balance is|Payouts total/);
    }
  });
});
