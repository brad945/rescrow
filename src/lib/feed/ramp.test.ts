import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import {
  applyTerms,
  createSale,
  declareInsolvency,
  IdempotencyConflict,
  receivePayment,
  type Clock,
} from "@/lib/escrow/engine";
import { reconcile } from "@/lib/escrow/reconcile";
import { drain, FakeRampFeed, type FeedTransaction } from "./ramp";

const G = "gal_lowline";

function clock(): Clock {
  let n = 0;
  return { now: () => "2026-11-10T15:00:00.000Z", id: (p) => `${p}_f${++n}` };
}

function openSale(c: Clock) {
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

/** Money and records, without the activity feed. */
const money = (s: Snapshot) => ({
  galleries: s.galleries,
  payments: s.payments,
  holds: s.holds,
  payouts: s.payouts,
  journal: s.journal,
});

describe("idempotent ingest in receivePayment", () => {
  it("a redelivered transaction moves nothing and logs one row for the artist", () => {
    const c = clock();
    const { sale, snapshot } = openSale(c);
    const once = receivePayment(
      snapshot,
      { saleId: sale.id, method: "wire", rampTransactionId: "rtx_1" },
      c,
    ).snapshot;
    const twice = receivePayment(
      once,
      { saleId: sale.id, method: "wire", rampTransactionId: "rtx_1" },
      c,
    ).snapshot;
    expect(money(twice)).toEqual(money(once));
    expect(twice.activity).toHaveLength(once.activity.length + 1);
    expect(twice.activity[0]).toMatchObject({
      kind: "feed_duplicate",
      artistId: "art_ines",
    });
    expect(reconcile(twice, G).breaks).toEqual([]);
  });

  it("a retried final payment with no amount is a no-op, not a conflict", () => {
    const c = clock();
    const { sale, snapshot } = openSale(c);
    let s = snapshot;
    for (const n of [1, 2, 3]) {
      s = receivePayment(
        s,
        { saleId: sale.id, rampTransactionId: `rtx_${n}` },
        c,
      ).snapshot;
    }
    expect(s.sales.find((x) => x.id === sale.id)!.status).toBe("paid");
    const again = receivePayment(
      s,
      { saleId: sale.id, rampTransactionId: "rtx_3" },
      c,
    ).snapshot;
    expect(money(again)).toEqual(money(s));
  });

  it("the same id with a different amount is refused", () => {
    const c = clock();
    const { sale, snapshot } = openSale(c);
    const s = receivePayment(
      snapshot,
      { saleId: sale.id, amountCents: 800_000, rampTransactionId: "rtx_1" },
      c,
    ).snapshot;
    expect(() =>
      receivePayment(
        s,
        { saleId: sale.id, amountCents: 700_000, rampTransactionId: "rtx_1" },
        c,
      ),
    ).toThrow(IdempotencyConflict);
    expect(() =>
      receivePayment(
        s,
        { saleId: sale.id, method: "card", rampTransactionId: "rtx_1" },
        c,
      ),
    ).toThrow(/already booked with different details/);
  });

  it("a redelivery after insolvency is still a no-op, not an error", () => {
    const c = clock();
    const { sale, snapshot } = openSale(c);
    let s = receivePayment(
      snapshot,
      { saleId: sale.id, rampTransactionId: "rtx_1" },
      c,
    ).snapshot;
    s = declareInsolvency(s, { galleryId: G }, c).snapshot;
    const again = receivePayment(
      s,
      { saleId: sale.id, rampTransactionId: "rtx_1" },
      c,
    ).snapshot;
    expect(money(again)).toEqual(money(s));
    // A new transaction is still refused: the gallery is insolvent.
    expect(() =>
      receivePayment(s, { saleId: sale.id, rampTransactionId: "rtx_2" }, c),
    ).toThrow(/insolvent/);
  });

  it("every payment gets a transaction id, even without one supplied", () => {
    const c = clock();
    const { sale, snapshot } = openSale(c);
    const s = receivePayment(snapshot, { saleId: sale.id }, c).snapshot;
    expect(s.payments.at(-1)!.rampTransactionId).toMatch(/^rtx_/);
  });
});

describe("FakeRampFeed: overlapping, repeated and reordered pages", () => {
  it("books each transaction exactly once", () => {
    const c = clock();
    const { sale, snapshot } = openSale(c);
    const tx = (id: string, amountCents: number): FeedTransaction => ({
      id,
      amountCents,
      method: "wire",
      memo: `Orchard in Rain RSC-${sale.id}`,
    });
    const a = tx("rtx_a", 800_000);
    const b = tx("rtx_b", 800_000);
    const c3 = tx("rtx_c", 800_000);
    const stray: FeedTransaction = {
      id: "rtx_x",
      amountCents: 5_000,
      method: "ach",
      memo: "rent refund",
    };
    const feed = new FakeRampFeed([
      { transactions: [a, b], next: "p2" },
      { transactions: [b, a, stray], next: "p3" }, // overlap + reorder
      { transactions: [c3, b], next: null },
    ]);
    const r = drain(snapshot, feed, c);
    expect(r.booked).toEqual(["rtx_a", "rtx_b", "rtx_c"]);
    expect(r.duplicates).toEqual(["rtx_b", "rtx_a", "rtx_b"]);
    expect(r.unmatched).toEqual(["rtx_x"]);
    const s = r.snapshot;
    expect(s.payments.filter((p) => p.saleId === sale.id)).toHaveLength(3);
    expect(s.sales.find((x) => x.id === sale.id)!.status).toBe("paid");
    expect(reconcile(s, G).breaks).toEqual([]);
  });
});

describe("one bad transaction doesn't stall the page", () => {
  it("books the rest and sets the refused one aside with its reason", () => {
    const c = clock();
    const { sale, snapshot } = openSale(c);
    const r = drain(
      snapshot,
      new FakeRampFeed([
        {
          transactions: [
            // Tidewater was paid in full in the seed: refused, not fatal.
            {
              id: "rtx_late",
              amountCents: 100,
              method: "wire",
              memo: "RSC-sale_tidewater",
            },
            {
              id: "rtx_ok",
              amountCents: 800_000,
              method: "wire",
              memo: `RSC-${sale.id}`,
            },
          ],
          next: null,
        },
      ]),
      c,
    );
    expect(r.booked).toEqual(["rtx_ok"]);
    expect(r.refused).toEqual([
      { id: "rtx_late", reason: expect.stringMatching(/is paid/) },
    ]);
    expect(reconcile(r.snapshot, G).breaks).toEqual([]);
  });

  it("a conflicting redelivery still stops the feed", () => {
    const c = clock();
    const { sale, snapshot } = openSale(c);
    const tx = { id: "rtx_1", method: "wire" as const, memo: `RSC-${sale.id}` };
    expect(() =>
      drain(
        snapshot,
        new FakeRampFeed([
          { transactions: [{ ...tx, amountCents: 800_000 }], next: "p2" },
          { transactions: [{ ...tx, amountCents: 700_000 }], next: null },
        ]),
        c,
      ),
    ).toThrow(IdempotencyConflict);
  });
});
