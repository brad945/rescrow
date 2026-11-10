import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import { balancesOf } from "./journal";
import {
  applyTerms,
  closePeriod,
  createSale,
  declareInsolvency,
  receivePayment,
  type Clock,
} from "./engine";
import { nextMonthToClose, sealOf } from "@/lib/books";
import { reconcile } from "./reconcile";

const G = "gal_lowline";

function clockAt(iso: string): Clock {
  let n = 0;
  return { now: () => iso, id: (p) => `${p}_c${++n}` };
}
// The seed's history is in October 2026; "now" is mid-November.
const NOV = clockAt("2026-11-10T15:00:00.000Z");

function refused(s: Snapshot, run: () => unknown, why: RegExp) {
  const before = structuredClone(s);
  expect(run).toThrow(why);
  expect(s).toEqual(before);
}

describe("month-end close", () => {
  it("closes October on the seed and seals it", () => {
    const s = createSeed();
    expect(nextMonthToClose(s, G)).toBe("2026-10");
    const { snapshot, close } = closePeriod(
      s,
      { galleryId: G, month: "2026-10" },
      NOV,
    );
    expect(close.checks.map((c) => c.ok)).toEqual([true, true]);
    const octEntries = s.journal.filter((e) => e.at <= close.through);
    expect(close.entryCount).toBe(octEntries.length);
    expect(close.totals).toEqual(Object.fromEntries(balancesOf(octEntries)));
    expect(snapshot.activity[0].kind).toBe("period_closed");
    expect(reconcile(snapshot, G).breaks).toEqual([]);
    expect(nextMonthToClose(snapshot, G)).toBe("2026-11");
  });

  it("refuses while the books don't reconcile (a planted cent in operating)", () => {
    const s = createSeed();
    s.galleries[0].operatingBalanceCents += 1;
    refused(
      s,
      () => closePeriod(s, { galleryId: G, month: "2026-10" }, NOV),
      /books reconcile failed/,
    );
  });

  it("refuses while the journal disagrees with trust (a planted trust posting)", () => {
    const s = createSeed();
    s.journal
      .find(
        (e) =>
          e.code === "RECEIPT_SPLIT" &&
          e.postings.some((p) => p.account.includes("art_theo")),
      )!
      .postings.find((p) => p.account.startsWith("trust:"))!.cents += 1;
    refused(
      s,
      () => closePeriod(s, { galleryId: G, month: "2026-10" }, NOV),
      /Journal trust for art_theo/,
    );
  });

  it("refuses while a share is past its deadline", () => {
    const s = createSeed(); // Theo's share is due 2026-11-13
    refused(
      s,
      () =>
        closePeriod(
          s,
          { galleryId: G, month: "2026-10" },
          clockAt("2026-11-20T00:00:00.000Z"),
        ),
      /nothing overdue failed/,
    );
  });

  it("closes months in order: no twice, no gaps, not before the month ends", () => {
    const once = closePeriod(
      createSeed(),
      { galleryId: G, month: "2026-10" },
      NOV,
    ).snapshot;
    refused(
      once,
      () => closePeriod(once, { galleryId: G, month: "2026-10" }, NOV),
      /next month to close is November 2026/,
    );
    refused(
      once,
      () =>
        closePeriod(
          once,
          { galleryId: G, month: "2026-12" },
          clockAt("2027-01-05T00:00:00.000Z"),
        ),
      /next month to close/,
    );
    refused(
      once,
      () => closePeriod(once, { galleryId: G, month: "2026-11" }, NOV),
      /hasn't ended yet/,
    );
  });

  it("after a close, new payments post normally and the seal still holds", () => {
    let s = applyTerms(
      closePeriod(createSeed(), { galleryId: G, month: "2026-10" }, NOV)
        .snapshot,
      {
        agreementId: "agr_ines",
        terms: FIXTURE_TERMS.agr_ines!,
        source: "fixture",
      },
      NOV,
    );
    const { sale, snapshot } = createSale(
      s,
      { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
      NOV,
    );
    s = receivePayment(snapshot, { saleId: sale.id }, NOV).snapshot;
    expect(reconcile(s, G).breaks).toEqual([]);
  });

  it("an insolvent gallery's books can still be closed", () => {
    const failed = declareInsolvency(
      createSeed(),
      { galleryId: G },
      NOV,
    ).snapshot;
    const { close } = closePeriod(
      failed,
      { galleryId: G, month: "2026-10" },
      NOV,
    );
    expect(close.checks.every((c) => c.ok)).toBe(true);
  });

  it("sealOf counts only entries through the month", () => {
    const s = createSeed();
    expect(sealOf(s, G, "2026-09-30T23:59:59.999Z").entryCount).toBe(0);
  });
});

describe("a closed month is sealed: later changes are named breaks", () => {
  const closed = () =>
    closePeriod(createSeed(), { galleryId: G, month: "2026-10" }, NOV).snapshot;
  const sealBreak =
    /Books closed for 2026-10 with \d+ entries; the journal now shows/;

  it("an edited entry", () => {
    const s = closed();
    s.journal[1].postings[0].cents -= 5;
    s.journal[1].postings[1].cents += 5;
    expect(reconcile(s, G).breaks.join("\n")).toMatch(sealBreak);
  });
  it("a deleted entry", () => {
    const s = closed();
    s.journal.splice(1, 1);
    expect(reconcile(s, G).breaks.join("\n")).toMatch(sealBreak);
  });
  it("an entry inserted into the closed month", () => {
    const s = closed();
    s.journal.push({
      id: "je_backdated",
      at: "2026-10-20T00:00:00.000Z",
      code: "TRANSFER",
      postings: [
        { account: "operating:gal_lowline", cents: -1 },
        { account: "creditors:gal_lowline", cents: 1 },
      ],
      ref: null,
    });
    expect(reconcile(s, G).breaks.join("\n")).toMatch(sealBreak);
  });
});
