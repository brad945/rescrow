// Model-based random test of the whole engine.
//
// Each run interleaves sales across every artist, full and partial payments,
// cancellations, time passing (so deadline payouts fire mid-sale) and, rarely,
// the gallery failing. After every single step the books must reconcile to the
// cent and a set of invariants must hold. Runs are seeded, so a failure prints
// the seed and step and replays exactly.
import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import { shareOf } from "@/lib/money";
import type { EscrowHold, Snapshot } from "@/types";
import {
  applyTerms,
  cancelSale,
  createSale,
  declareInsolvency,
  EscrowError,
  paidSoFar,
  receivePayment,
  releaseDueHolds,
  type Clock,
} from "./engine";
import { reconcile } from "./reconcile";

const G = "gal_lowline";
const RUNS = 250;
const STEPS = 60;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 2 ** 32;
  };
}

function movingClock(startIso: string) {
  let t = Date.parse(startIso);
  let n = 0;
  const clock: Clock = {
    now: () => new Date(t).toISOString(),
    id: (prefix) => `${prefix}_m${++n}`,
  };
  return { clock, advanceDays: (d: number) => (t += d * 86_400_000) };
}

function start(clock: Clock): Snapshot {
  let s = createSeed();
  for (const [agreementId, terms] of Object.entries(FIXTURE_TERMS)) {
    s = applyTerms(s, { agreementId, terms, source: "fixture" }, clock);
  }
  return s;
}

type Counts = Record<
  "sell" | "pay" | "partial" | "cancel" | "time" | "fail" | "refused",
  number
>;

/** Every invariant that must hold after any step. Returns failures by name. */
function violations(prev: Snapshot, s: Snapshot): string[] {
  const out: string[] = [];
  const r = reconcile(s, G);
  if (!r.balanced) out.push(`reconcile: ${r.breaks.join("; ")}`);

  // Holds: never negative, and once paid or refunded they never change again.
  const before = new Map(prev.holds.map((h) => [h.id, h]));
  for (const h of s.holds) {
    if (h.amountCents < 0) out.push(`hold ${h.id} is negative`);
    const p = before.get(h.id);
    if (p && p.status !== "locked" && p.status !== h.status) {
      out.push(`hold ${h.id} left terminal state ${p.status}`);
    }
    if (p && p.amountCents !== h.amountCents) {
      out.push(`hold ${h.id} changed amount`);
    }
  }
  // No hold disappears.
  for (const id of before.keys()) {
    if (!s.holds.some((h) => h.id === id)) out.push(`hold ${id} vanished`);
  }

  // Per sale: the artist's holds add up to exactly their share of what was
  // paid (running-total rounding never leaks a cent), and a paid sale has
  // nothing left locked.
  for (const sale of s.sales) {
    const holds = s.holds.filter((h) => h.saleId === sale.id);
    const sum = holds.reduce((a, h) => a + h.amountCents, 0);
    const want = shareOf(paidSoFar(s, sale.id), sale.artistShareBps);
    if (sum !== want) {
      out.push(`sale ${sale.id}: holds ${sum} but share of paid is ${want}`);
    }
    if (
      sale.status === "paid" &&
      holds.some((h: EscrowHold) => h.status === "locked")
    ) {
      out.push(`sale ${sale.id} is paid but still has locked holds`);
    }
  }

  // Payouts: every hold in a payout is paid and belongs to that artist.
  for (const p of s.payouts) {
    const holds = s.holds.filter((h) => p.holdIds.includes(h.id));
    if (holds.length !== p.holdIds.length) {
      out.push(`payout ${p.id} names a missing hold`);
    }
    for (const h of holds) {
      if (h.artistId !== p.artistId) {
        out.push(`payout ${p.id} pays ${p.artistId} from ${h.artistId}'s hold`);
      }
      if (h.status !== "paid") out.push(`payout ${p.id} has unpaid hold`);
    }
  }

  // After failure, nothing is left in trust and nothing new comes in.
  const g = s.galleries.find((x) => x.id === G)!;
  if (g.status === "insolvent") {
    if (r.trustCents !== 0) out.push("trust not empty after insolvency");
    if (s.artworks.some((w) => w.galleryId === G && w.status === "consigned")) {
      out.push("consigned work left in the estate after insolvency");
    }
    if (g.operatingBalanceCents !== 0)
      out.push("operating not 0 after insolvency");
    if (
      s.payments.length !== prev.payments.length &&
      prev.galleries[0].status === "insolvent"
    ) {
      out.push("payment accepted after insolvency");
    }
  }
  return out;
}

function run(seed: number, counts: Counts) {
  const rand = rng(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const { clock, advanceDays } = movingClock("2026-11-10T15:00:00.000Z");
  let s = start(clock);

  for (let step = 0; step < STEPS; step++) {
    const prev = s;
    const roll = rand();
    try {
      if (roll < 0.2) {
        const work = pick(s.artworks.filter((w) => w.status === "consigned"));
        if (!work) continue;
        s = createSale(
          s,
          {
            artworkId: work.id,
            buyerName: `Buyer ${step}`,
            installments: 1 + Math.floor(rand() * 4),
          },
          clock,
        ).snapshot;
        counts.sell++;
      } else if (roll < 0.6) {
        const sale = pick(s.sales.filter((x) => x.status === "open"));
        if (!sale) continue;
        const remaining = sale.priceCents - paidSoFar(s, sale.id);
        // Half the time an awkward partial amount, to stress rounding.
        const partial = rand() < 0.5;
        const amountCents = partial
          ? 1 + Math.floor(rand() * remaining)
          : undefined;
        s = receivePayment(
          s,
          {
            saleId: sale.id,
            amountCents,
            method: pick(["wire", "ach", "card"]),
          },
          clock,
        ).snapshot;
        counts[partial ? "partial" : "pay"]++;
      } else if (roll < 0.7) {
        const sale = pick(s.sales.filter((x) => x.status === "open"));
        if (!sale) continue;
        s = cancelSale(s, { saleId: sale.id }, clock).snapshot;
        counts.cancel++;
      } else if (roll < 0.98) {
        advanceDays(Math.floor(rand() * 25));
        s = releaseDueHolds(s, clock);
        counts.time++;
      } else {
        s = declareInsolvency(s, { galleryId: G }, clock).snapshot;
        counts.fail++;
      }
    } catch (e) {
      if (!(e instanceof EscrowError)) throw e;
      // A refused operation must leave the books exactly as they were.
      expect(s).toBe(prev);
      counts.refused++;
    }
    const bad = violations(prev, s);
    if (bad.length) {
      throw new Error(`seed ${seed}, step ${step}: ${bad.join(" | ")}`);
    }
  }
}

describe("model-based: random interleavings keep every invariant", () => {
  it(`${RUNS} seeded runs of ${STEPS} steps`, () => {
    const counts: Counts = {
      sell: 0,
      pay: 0,
      partial: 0,
      cancel: 0,
      time: 0,
      fail: 0,
      refused: 0,
    };
    for (let seed = 1; seed <= RUNS; seed++) run(seed, counts);
    // Coverage gate: a generator that never reaches a branch proves nothing
    // about it, so each kind of step must actually have happened.
    for (const [kind, n] of Object.entries(counts)) {
      expect(n, `${kind} never exercised`).toBeGreaterThan(10);
    }
  });

  it("a deadline payout followed by a cancellation still balances", () => {
    const { clock, advanceDays } = movingClock("2026-11-10T15:00:00.000Z");
    let s = start(clock);
    const { sale, snapshot } = createSale(
      s,
      { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
      clock,
    );
    s = receivePayment(snapshot, { saleId: sale.id }, clock).snapshot;
    advanceDays(61);
    s = releaseDueHolds(s, clock);
    expect(s.holds.filter((h) => h.saleId === sale.id)[0].status).toBe("paid");
    s = cancelSale(s, { saleId: sale.id }, clock).snapshot;
    expect(reconcile(s, G).breaks).toEqual([]);
  });
});
