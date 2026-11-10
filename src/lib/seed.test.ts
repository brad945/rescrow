import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "./seed";

describe("seed data", () => {
  it("only cites clauses that appear word for word in each agreement", () => {
    const seed = createSeed();
    for (const [id, terms] of Object.entries(FIXTURE_TERMS)) {
      const text = seed.agreements.find((a) => a.id === id)!.text;
      for (const citation of terms.citations) {
        expect(text, `${id}: "${citation}"`).toContain(citation);
      }
    }
  });

  it("starts with the books balanced: trust holds match unpaid locked shares", () => {
    const seed = createSeed();
    for (const hold of seed.holds) {
      const payment = seed.payments.find((p) => p.id === hold.paymentId)!;
      const sale = seed.sales.find((x) => x.id === hold.saleId)!;
      expect(hold.amountCents).toBe(
        Math.round((payment.amountCents * sale.artistShareBps) / 10_000),
      );
    }
  });
});
