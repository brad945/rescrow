import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import {
  applyTerms,
  attemptTrustMove,
  cancelSale,
  createSale,
  declareInsolvency,
  EscrowError,
  receivePayment,
  releaseDueHolds,
  releaseTrust,
  type Clock,
} from "./engine";
import { reconcile } from "./reconcile";

const G = "gal_lowline";

function clockAt(iso: string): Clock & { set: (iso: string) => void } {
  let now = iso;
  let n = 0;
  return {
    now: () => now,
    id: (prefix) => `${prefix}_t${++n}`,
    set: (next) => {
      now = next;
    },
  };
}

/** Ines sells Orchard in Rain ($24,000, 3 payments) and two payments land. */
function midSale(clock: Clock) {
  // Step 1 of /present: the agent reads Ines's agreement.
  let s: Snapshot = applyTerms(
    createSeed(),
    {
      agreementId: "agr_ines",
      terms: FIXTURE_TERMS.agr_ines,
      source: "fixture",
    },
    clock,
  );
  const created = createSale(
    s,
    { artworkId: "wrk_orchard", buyerName: "Marisol Ybarra", installments: 3 },
    clock,
  );
  s = created.snapshot;
  s = receivePayment(s, { saleId: created.sale.id }, clock).snapshot;
  s = receivePayment(s, { saleId: created.sale.id }, clock).snapshot;
  return { s, saleId: created.sale.id };
}

function expectBalanced(s: Snapshot) {
  const r = reconcile(s, G);
  expect(r.breaks).toEqual([]);
  expect(r.balanced).toBe(true);
}

describe("trust guard", () => {
  it("refuses to move trust funds to the gallery's operating account", () => {
    const { s } = midSale(clockAt("2026-11-10T15:00:00.000Z"));
    const locked = s.holds.filter((h) => h.status === "locked");
    expect(locked.length).toBeGreaterThan(0);
    expect(() =>
      releaseTrust(
        s,
        locked,
        "operating" as never,
        clockAt("2026-11-10T15:00:00.000Z"),
      ),
    ).toThrow(EscrowError);
    expect(() =>
      releaseTrust(
        s,
        locked,
        "creditors" as never,
        clockAt("2026-11-10T15:00:00.000Z"),
      ),
    ).toThrow(/Trust funds/);
  });

  it("refuses to release a hold that is no longer locked", () => {
    const { s } = midSale(clockAt("2026-11-10T15:00:00.000Z"));
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const locked = s.holds.filter((h) => h.status === "locked");
    releaseTrust(s, locked, "artist", clock);
    expect(() => releaseTrust(s, locked, "artist", clock)).toThrow(EscrowError);
  });
});

describe("payout deadline from the agreement", () => {
  it("stamps each hold with receipt + the agreement's payout days", () => {
    const { s, saleId } = midSale(clockAt("2026-11-10T15:00:00.000Z"));
    const holds = s.holds.filter((h) => h.saleId === saleId);
    expect(holds).toHaveLength(2);
    // Ines's agreement: 60 days from each payment.
    for (const h of holds) expect(h.dueBy).toBe("2027-01-09T15:00:00.000Z");
  });

  it("pays out a hold that reaches its deadline while the sale is still open", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s, saleId } = midSale(clock);
    clock.set("2027-01-09T15:00:00.000Z");
    const after = releaseDueHolds(s, clock);
    const holds = after.holds.filter((h) => h.saleId === saleId);
    expect(holds.every((h) => h.status === "paid")).toBe(true);
    const payout = after.payouts.find((p) => p.holdIds.includes(holds[0].id))!;
    expect(payout.amountCents).toBe(800_000);
    expect(after.sales.find((x) => x.id === saleId)!.status).toBe("open");
    expect(after.activity[0].kind).toBe("deadline_payout");
    expectBalanced(after);
  });

  it("leaves holds alone before their deadline and returns the same state", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s } = midSale(clock);
    clock.set("2027-01-09T14:59:59.000Z");
    expect(releaseDueHolds(s, clock)).toBe(s);
  });
});

describe("gallery insolvency", () => {
  it("sends operating cash to creditors and pays every artist out of trust", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s, saleId } = midSale(clock);
    const operatingBefore = s.galleries[0].operatingBalanceCents;
    const lockedBefore = s.holds.filter((h) => h.status === "locked");
    const after = declareInsolvency(s, { galleryId: G }, clock).snapshot;

    const gallery = after.galleries[0];
    expect(gallery.status).toBe("insolvent");
    expect(gallery.operatingBalanceCents).toBe(0);
    expect(gallery.claimedByCreditorsCents).toBe(operatingBefore);
    expect(after.holds.filter((h) => h.status === "locked")).toEqual([]);

    // Ines gets her $8,000 from the two Orchard payments, in one payout for that sale.
    const ines = after.payouts.filter(
      (p) => p.artistId === "art_ines" && p.paidAt === clock.now(),
    );
    expect(ines).toHaveLength(1);
    expect(ines[0].amountCents).toBe(800_000);
    const paidNow = after.payouts
      .filter((p) => p.paidAt === clock.now())
      .reduce((t, p) => t + p.amountCents, 0);
    expect(paidNow).toBe(lockedBefore.reduce((t, h) => t + h.amountCents, 0));
    expect(after.activity.some((a) => a.kind === "creditor_claim")).toBe(true);
    expect(after.sales.find((x) => x.id === saleId)!.status).toBe("open");
    expectBalanced(after);
  });

  it("refuses new sales, payments and cancellations once insolvent", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s, saleId } = midSale(clock);
    const after = declareInsolvency(s, { galleryId: G }, clock).snapshot;
    expect(() => receivePayment(after, { saleId }, clock)).toThrow(/insolvent/);
    expect(() => cancelSale(after, { saleId }, clock)).toThrow(/insolvent/);
    expect(() =>
      createSale(
        after,
        { artworkId: "wrk_salt", buyerName: "X", installments: 1 },
        clock,
      ),
    ).toThrow(/insolvent/);
  });

  it("is a no-op the second time", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s } = midSale(clock);
    const once = declareInsolvency(s, { galleryId: G }, clock).snapshot;
    const twice = declareInsolvency(once, { galleryId: G }, clock).snapshot;
    expect(twice).toEqual(once);
  });
});

describe("reconciliation", () => {
  it("balances on the seed", () => {
    expectBalanced(createSeed());
  });

  it("balances through a sale, a cancellation and an insolvency", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    let { s } = midSale(clock);
    expectBalanced(s);
    const salt = createSale(
      s,
      { artworkId: "wrk_salt", buyerName: "Y", installments: 2 },
      clock,
    );
    s = receivePayment(salt.snapshot, { saleId: salt.sale.id }, clock).snapshot;
    expectBalanced(s);
    s = cancelSale(s, { saleId: salt.sale.id }, clock).snapshot;
    expectBalanced(s);
    s = declareInsolvency(s, { galleryId: G }, clock).snapshot;
    expectBalanced(s);
  });

  it("reports a break when money appears from nowhere", () => {
    const s = createSeed();
    s.galleries[0].operatingBalanceCents += 1;
    const r = reconcile(s, G);
    expect(r.balanced).toBe(false);
    expect(r.breaks.join(" ")).toMatch(/operating/i);
  });
});

describe("terms frozen at sale close", () => {
  it("a mid-sale re-read with a shorter window does not move this sale's deadlines", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s: mid, saleId } = midSale(clock);
    const reread = applyTerms(
      mid,
      {
        agreementId: "agr_ines",
        terms: { ...FIXTURE_TERMS.agr_ines!, payoutDays: 10 },
        source: "fixture",
      },
      clock,
    );
    const after = receivePayment(reread, { saleId }, clock).snapshot;
    const holds = after.holds.filter((h) => h.saleId === saleId);
    expect(holds).toHaveLength(3);
    for (const h of holds) expect(h.dueBy).toBe("2027-01-09T15:00:00.000Z");
    expect(after.sales.find((x) => x.id === saleId)!.payoutDays).toBe(60);
    expectBalanced(after);
  });
});

describe("attemptTrustMove: the gallery tries to spend trust", () => {
  for (const kind of ["rent", "creditor"] as const) {
    it(`refuses ${kind}, logs it on Ines's feed, and moves nothing`, () => {
      const clock = clockAt("2026-11-10T15:00:00.000Z");
      const { s, saleId } = midSale(clock);
      const { snapshot: after, refusal } = attemptTrustMove(
        s,
        { saleId, kind },
        clock,
      );
      expect(refusal).toMatch(/Trust funds can only go to the artist/);
      for (const k of ["galleries", "holds", "payments", "payouts"] as const) {
        expect(after[k]).toEqual(s[k]);
      }
      expect(after.activity).toHaveLength(s.activity.length + 1);
      const row = after.activity[0];
      expect(row.kind).toBe("trust_move_refused");
      expect(row.artistId).toBe("art_ines");
      // Only the story sale's trust: Ines's $8,000, not Theo's seeded $2,400.
      expect(row.amountCents).toBe(800_000);
      expect(row.message).toMatch(/^Refused: .*\$8,000\.00.*Nothing moved$/);
      expectBalanced(after);
    });
  }

  it("has nothing to try before the first payment", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const s = applyTerms(
      createSeed(),
      {
        agreementId: "agr_ines",
        terms: FIXTURE_TERMS.agr_ines,
        source: "fixture",
      },
      clock,
    );
    const { sale, snapshot } = createSale(
      s,
      { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
      clock,
    );
    expect(() =>
      attemptTrustMove(snapshot, { saleId: sale.id, kind: "rent" }, clock),
    ).toThrow(/Nothing in trust/);
  });
});
