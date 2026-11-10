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

  it("leaves holds alone before their deadline", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s, saleId } = midSale(clock);
    clock.set("2027-01-09T14:59:59.000Z");
    // One second before Ines's 60-day deadline. (Theo's 14-day seeded share
    // is long due by now and pays; that is the next case.)
    const after = releaseDueHolds(s, clock);
    const story = after.holds.filter((h) => h.saleId === saleId);
    expect(story.map((h) => h.status)).toEqual(["locked", "locked"]);
  });

  it("returns the very same state when nothing is due", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s } = midSale(clock);
    clock.set("2026-11-12T16:41:12.000Z"); // seed time + 3 days: Theo not due yet
    expect(releaseDueHolds(s, clock)).toBe(s);
  });

  it("pays Theo's seeded share on its own 14-day deadline", () => {
    const clock = clockAt("2026-11-13T16:41:12.000Z");
    const after = releaseDueHolds(createSeed(), clock);
    const theo = after.payouts.filter((p) => p.artistId === "art_theo");
    expect(theo).toHaveLength(1);
    expect(theo[0]).toMatchObject({ amountCents: 240_000, reason: "deadline" });
    expectBalanced(after);
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
      expect(refusal).toMatch(
        /^Ledger refused TRANSFER: trust:gal_lowline:art_ines is held in trust/,
      );
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

describe("refund records: the buyer is made whole", () => {
  it("cancel after a deadline payout: buyer gets every cent back, artist keeps the share, trust untouched", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s: mid, saleId } = midSale(clock);
    clock.set("2027-01-10T15:00:00.000Z"); // past both 60-day deadlines
    const due = releaseDueHolds(mid, clock);
    const s = cancelSale(due, { saleId }, clock).snapshot;
    const r = s.refunds.find((x) => x.saleId === saleId)!;
    expect(r).toMatchObject({
      fromTrustCents: 0,
      fromOperatingCents: 800_000,
      coveredByGalleryCents: 800_000,
    });
    const ines = s.payouts
      .filter((p) => p.artistId === "art_ines")
      .reduce((a, p) => a + p.amountCents, 0);
    expect(ines).toBe(800_000);
    expect(s.activity.some((a) => a.kind === "gallery_covered_refund")).toBe(
      true,
    );
    expectBalanced(s);
  });

  it("refuses a refund operating can't cover, and changes nothing", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s: mid, saleId } = midSale(clock);
    const poor = structuredClone(mid);
    const g = poor.galleries[0];
    g.operatingBalanceCents = 100;
    const before = structuredClone(poor);
    expect(() => cancelSale(poor, { saleId }, clock)).toThrow(/can't refund/);
    expect(poor).toEqual(before);
  });

  it("refuses to cancel twice", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s: mid, saleId } = midSale(clock);
    const once = cancelSale(mid, { saleId }, clock).snapshot;
    expect(() => cancelSale(once, { saleId }, clock)).toThrow(
      /Only open sales/,
    );
    expect(once.refunds).toHaveLength(1);
  });
});

describe("cancel after a deadline has passed, before anything polled", () => {
  it("pays the overdue share to the artist first, then refunds the buyer in full", () => {
    // Theo's seeded share is due 4 days after the seed time; cancel 5 days on.
    const clock = clockAt("2026-11-14T16:41:12.000Z");
    const s = cancelSale(
      createSeed(),
      { saleId: "sale_lamps" },
      clock,
    ).snapshot;
    const hold = s.holds.find((h) => h.id === "hold_lamps_1")!;
    expect(hold.status).toBe("paid");
    const r = s.refunds.find((x) => x.saleId === "sale_lamps")!;
    expect(r.fromTrustCents).toBe(0);
    expect(r.coveredByGalleryCents).toBe(240_000);
    expect(r.fromOperatingCents + r.coveredByGalleryCents).toBe(400_000);
    expectBalanced(s);
  });

  it("a hold refunded outside a cancellation is a reconciliation break", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s } = midSale(clock);
    const sneaky = structuredClone(s);
    const hold = sneaky.holds.find((h) => h.status === "locked")!;
    releaseTrust(sneaky, [hold], "buyer", clock);
    const r = reconcile(sneaky, G);
    expect(r.breaks.join(" ")).toMatch(
      /was refunded but its sale .* was never cancelled/,
    );
  });
});

describe("a payment after a deadline nobody polled", () => {
  it("pays the overdue share on its deadline first, then books the payment", () => {
    const clock = clockAt("2026-11-10T15:00:00.000Z");
    const { s: mid, saleId } = midSale(clock);
    clock.set("2027-01-15T15:00:00.000Z"); // past both 60-day deadlines, no poll
    const s = receivePayment(mid, { saleId }, clock).snapshot;
    const deadline = s.payouts.filter(
      (p) => p.artistId === "art_ines" && p.reason === "deadline",
    );
    expect(deadline.reduce((a, p) => a + p.amountCents, 0)).toBe(800_000);
    expect(s.sales.find((x) => x.id === saleId)!.status).toBe("paid");
    expectBalanced(s);
  });
});
