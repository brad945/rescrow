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
  galleryTotals,
  declareInsolvency,
  receivePayment,
  type Clock,
} from "@/lib/escrow/engine";
import { reconcile } from "@/lib/escrow/reconcile";
import { explain, type Metric } from "./explain";

const G = "gal_lowline";
let n = 0;
const clock: Clock = {
  now: () => "2026-11-10T15:00:00.000Z",
  id: (p) => `${p}_x${++n}`,
};

function states(): [string, Snapshot][] {
  const out: [string, Snapshot][] = [["reset", createSeed()]];
  let s = applyTerms(
    out[0][1],
    {
      agreementId: "agr_ines",
      terms: FIXTURE_TERMS.agr_ines!,
      source: "fixture",
    },
    clock,
  );
  const { sale, snapshot } = createSale(
    s,
    { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
    clock,
  );
  s = receivePayment(
    snapshot,
    { saleId: sale.id, rampTransactionId: "rtx_s1" },
    clock,
  ).snapshot;
  out.push(["payment 1", s]);
  s = receivePayment(
    s,
    { saleId: sale.id, rampTransactionId: "rtx_s2" },
    clock,
  ).snapshot;
  out.push(["payment 2", s]);
  out.push([
    "G",
    attemptTrustMove(s, { saleId: sale.id, kind: "rent" }, clock).snapshot,
  ]);
  out.push([
    "D",
    receivePayment(s, { saleId: sale.id, rampTransactionId: "rtx_s2" }, clock)
      .snapshot,
  ]);
  out.push([
    "closed October",
    closePeriod(s, { galleryId: G, month: "2026-10" }, clock).snapshot,
  ]);
  out.push(["T", advanceClock(s, { days: 61 }, clock)]);
  out.push([
    "T then C",
    cancelSale(advanceClock(s, { days: 61 }, clock), { saleId: sale.id }, clock)
      .snapshot,
  ]);
  out.push(["C", cancelSale(s, { saleId: sale.id }, clock).snapshot]);
  out.push(["B", declareInsolvency(s, { galleryId: G }, clock).snapshot]);
  return out;
}

const FIELD: Record<Metric, keyof ReturnType<typeof reconcile>> = {
  operating: "operatingCents",
  trust: "trustCents",
  paidToArtists: "paidToArtistsCents",
  refunded: "refundedToBuyersCents",
  creditors: "claimedByCreditorsCents",
  received: "receivedCents",
};

describe("explain: every balance opens into the records that sum to it", () => {
  it("each drawer sums to the figure on screen, at every demo state", () => {
    for (const [name, s] of states()) {
      const r = reconcile(s, G);
      for (const [metric, field] of Object.entries(FIELD) as [
        Metric,
        keyof typeof r,
      ][]) {
        const sum = explain(s, G, metric).reduce((t, x) => t + x.cents, 0);
        expect(sum, `${metric} in ${name}`).toBe(r[field]);
      }
    }
  });

  it("the two drawers /gallery opens sum to the figures it shows", () => {
    for (const [name, s] of states()) {
      const t = galleryTotals(s, G);
      const sum = (m: Metric) =>
        explain(s, G, m).reduce((a, r) => a + r.cents, 0);
      expect(sum("operating"), name).toBe(t.operatingCents);
      expect(sum("trust"), name).toBe(t.lockedCents);
    }
  });

  it("after B, the creditors' drawer is the operating balance at the failure", () => {
    const s = states().find(([n]) => n === "B")![1];
    const rows = explain(s, G, "creditors");
    expect(rows.reduce((t, r) => t + r.cents, 0)).toBe(4_983_627);
    expect(
      rows.some((r) => r.label === "Turned over to the administrator"),
    ).toBe(false);
  });

  it("every row points at a real record, and payments show their bank ids", () => {
    const s = states().find(([n]) => n === "payment 2")![1];
    const ids = new Set([
      ...s.payments.map((p) => p.id),
      ...s.payouts.map((p) => p.id),
      ...s.refunds.map((r) => r.id),
      ...s.sales.map((x) => x.id),
      ...s.galleries.map((g) => g.id),
      ...s.journal.map((e) => e.id),
    ]);
    for (const m of Object.keys(FIELD) as Metric[]) {
      for (const r of explain(s, G, m))
        expect(ids.has(r.ref), r.ref).toBe(true);
    }
    const labels = explain(s, G, "operating")
      .map((r) => r.label)
      .join("\n");
    expect(labels).toContain("rtx_s1");
    expect(labels).toContain("rtx_s2");
  });
});
