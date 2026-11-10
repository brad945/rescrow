import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import {
  applyTerms,
  artistTotals,
  cancelSale,
  createSale,
  EscrowError,
  galleryTotals,
  receivePayment,
  type Clock,
} from "./engine";

function testClock(): Clock {
  let n = 0;
  return {
    now: () => "2026-11-10T12:00:00.000Z",
    id: (prefix) => `${prefix}_${++n}`,
  };
}

describe("escrow engine", () => {
  it("locks the artist share of each installment and keeps it out of operating funds", () => {
    const clock = testClock();
    const seed = createSeed();
    const before = galleryTotals(seed, "gal_lowline");

    const { snapshot: s1, sale } = createSale(
      seed,
      { artworkId: "wrk_salt", buyerName: "J. Park", installments: 2 },
      clock,
    );
    const { snapshot: s2, hold } = receivePayment(
      s1,
      { saleId: sale.id },
      clock,
    );

    // $9,500 over 2 installments: $4,750 lands, Mara's 50% is $2,375.
    expect(hold.amountCents).toBe(237_500);
    expect(hold.status).toBe("locked");
    const after = galleryTotals(s2, "gal_lowline");
    expect(after.lockedCents - before.lockedCents).toBe(237_500);
    expect(after.operatingCents - before.operatingCents).toBe(237_500);
    expect(s2.sales.find((x) => x.id === sale.id)?.status).toBe("open");
  });

  it("pays the artist every locked share the moment the sale is fully paid", () => {
    const clock = testClock();
    const { snapshot: s1, sale } = createSale(
      createSeed(),
      { artworkId: "wrk_salt", buyerName: "J. Park", installments: 2 },
      clock,
    );
    const { snapshot: s2 } = receivePayment(s1, { saleId: sale.id }, clock);
    const { snapshot: s3 } = receivePayment(s2, { saleId: sale.id }, clock);

    expect(s3.sales.find((x) => x.id === sale.id)?.status).toBe("paid");
    const payout = s3.payouts.at(-1);
    expect(payout?.artistId).toBe("art_mara");
    expect(payout?.amountCents).toBe(475_000);
    expect(
      s3.holds.filter((h) => h.saleId === sale.id).map((h) => h.status),
    ).toEqual(["paid", "paid"]);
  });

  it("uses the split from the agreement (Theo gets 60%)", () => {
    const clock = testClock();
    const { snapshot: s1, sale } = createSale(
      createSeed(),
      { artworkId: "wrk_harbor", buyerName: "A. Gold", installments: 1 },
      clock,
    );
    const { snapshot: s2 } = receivePayment(s1, { saleId: sale.id }, clock);
    expect(s2.payouts.at(-1)?.amountCents).toBe(288_000);
    expect(artistTotals(s2, "art_theo").heldCents).toBe(240_000);
  });

  it("refunds locked funds when the buyer backs out and puts the work back", () => {
    const clock = testClock();
    const seed = createSeed();
    const operatingBefore = seed.galleries[0].operatingBalanceCents;

    const { snapshot: s1, sale } = createSale(
      seed,
      { artworkId: "wrk_salt", buyerName: "J. Park", installments: 3 },
      clock,
    );
    const { snapshot: s2 } = receivePayment(s1, { saleId: sale.id }, clock);
    const { snapshot: s3 } = cancelSale(s2, { saleId: sale.id }, clock);

    expect(s3.sales.find((x) => x.id === sale.id)?.status).toBe("cancelled");
    expect(s3.artworks.find((a) => a.id === "wrk_salt")?.status).toBe(
      "consigned",
    );
    expect(
      s3.holds.filter((h) => h.saleId === sale.id).map((h) => h.status),
    ).toEqual(["refunded"]);
    expect(s3.galleries[0].operatingBalanceCents).toBe(operatingBefore);
  });

  it("rejects payments larger than what is still owed", () => {
    const clock = testClock();
    const { snapshot, sale } = createSale(
      createSeed(),
      { artworkId: "wrk_salt", buyerName: "J. Park", installments: 2 },
      clock,
    );
    expect(() =>
      receivePayment(
        snapshot,
        { saleId: sale.id, amountCents: 2_000_000 },
        clock,
      ),
    ).toThrow(EscrowError);
  });

  it("refuses to sell work whose agreement the agent has not read", () => {
    expect(() =>
      createSale(
        createSeed(),
        { artworkId: "wrk_orchard", buyerName: "J. Park", installments: 1 },
        testClock(),
      ),
    ).toThrow(/not been read/);
  });

  it("allows the sale once the agent has read the agreement", () => {
    const clock = testClock();
    const s1 = applyTerms(
      createSeed(),
      {
        agreementId: "agr_ines",
        terms: FIXTURE_TERMS.agr_ines,
        source: "fixture",
      },
      clock,
    );
    const { sale } = createSale(
      s1,
      { artworkId: "wrk_orchard", buyerName: "J. Park", installments: 1 },
      clock,
    );
    expect(sale.artistId).toBe("art_ines");
  });

  it("refuses to sell on terms the verifier could not confirm", () => {
    const s1 = applyTerms(
      createSeed(),
      {
        agreementId: "agr_ines",
        terms: {
          ...FIXTURE_TERMS.agr_ines,
          checks: [{ label: "Payout deadline", ok: false, detail: "not set" }],
        },
        source: "model",
      },
      testClock(),
    );
    expect(() =>
      createSale(
        s1,
        { artworkId: "wrk_orchard", buyerName: "J. Park", installments: 1 },
        testClock(),
      ),
    ).toThrow(/needs a person to confirm: payout deadline/);
  });

  it("logs an agent_flag when a live read fell back to the saved answer", () => {
    const s1 = applyTerms(
      createSeed(),
      {
        agreementId: "agr_ines",
        terms: FIXTURE_TERMS.agr_ines,
        source: "fixture",
        flag: "connect ECONNREFUSED",
      },
      testClock(),
    );
    const flag = s1.activity.find((a) => a.kind === "agent_flag");
    expect(flag?.message).toMatch(/ECONNREFUSED/);
  });

  it("does not mutate its input", () => {
    const seed = createSeed();
    const copy = structuredClone(seed);
    createSale(
      seed,
      { artworkId: "wrk_salt", buyerName: "J. Park", installments: 1 },
      testClock(),
    );
    expect(seed).toEqual(copy);
  });
});
