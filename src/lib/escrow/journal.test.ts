import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { JournalEntry, Snapshot } from "@/types";
import {
  applyTerms,
  cancelSale,
  createSale,
  declareInsolvency,
  LedgerRejected,
  receivePayment,
  releaseDueHolds,
  type Clock,
} from "./engine";
import {
  ACCOUNT_RULES,
  acct,
  balancesOf,
  entry,
  post,
  postTrustRelease,
} from "./journal";
import { reconcile } from "./reconcile";

const G = "gal_lowline";
const AT = "2026-11-10T15:00:00.000Z";

function clockAt(iso: string): Clock & { advanceDays: (d: number) => void } {
  let t = Date.parse(iso);
  let n = 0;
  return {
    now: () => new Date(t).toISOString(),
    id: (p) => `${p}_j${++n}`,
    advanceDays: (d) => (t += d * 86_400_000),
  };
}

function midSale(clock: Clock) {
  let s = applyTerms(
    createSeed(),
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
  s = receivePayment(snapshot, { saleId: sale.id }, clock).snapshot;
  s = receivePayment(s, { saleId: sale.id }, clock).snapshot;
  return { s, saleId: sale.id };
}

const e = (
  postings: JournalEntry["postings"],
  code: JournalEntry["code"] = "TRANSFER",
) => ({ id: "je_x", at: AT, code, postings, ref: null }) as JournalEntry;

/** post() must throw LedgerRejected and leave the snapshot exactly as it was. */
function refused(s: Snapshot, attempt: () => void, why: RegExp) {
  const before = structuredClone(s);
  expect(attempt).toThrow(LedgerRejected);
  expect(attempt).toThrow(why);
  expect(s).toEqual(before);
}

describe("journal: post() refuses bad entries before anything changes", () => {
  const { s } = midSale(clockAt(AT));
  const op = acct.operating(G);
  const ines = acct.trust(G, "art_ines");

  it("unbalanced", () =>
    refused(
      s,
      () =>
        post(
          s,
          e([
            { account: op, cents: -5 },
            { account: acct.creditors(G), cents: 4 },
          ]),
        ),
      /sum to -1, not zero/,
    ));
  it("a single posting", () =>
    refused(
      s,
      () => post(s, e([{ account: op, cents: 0 }])),
      /at least two postings/,
    ));
  it("a fractional cent", () =>
    refused(
      s,
      () =>
        post(
          s,
          e([
            { account: op, cents: -0.5 },
            { account: acct.creditors(G), cents: 0.5 },
          ]),
        ),
      /not a whole/,
    ));
  it("an unknown account", () =>
    refused(
      s,
      () =>
        post(
          s,
          e([
            { account: op, cents: -1 },
            { account: "petty:cash", cents: 1 },
          ]),
        ),
      /Unknown account/,
    ));
  it("operating below zero", () =>
    refused(
      s,
      () =>
        post(
          s,
          e(
            [
              { account: op, cents: -99_999_999 },
              { account: acct.creditors(G), cents: 99_999_999 },
            ],
            "OPERATING_TO_CREDITORS",
          ),
        ),
      /below its floor/,
    ));
  it("trust to operating, by any code", () => {
    for (const code of [
      "TRANSFER",
      "TRUST_TO_ARTIST",
      "OPERATING_TO_BUYER",
    ] as const) {
      refused(
        s,
        () =>
          post(
            s,
            e(
              [
                { account: ines, cents: -100 },
                { account: op, cents: 100 },
              ],
              code,
            ),
          ),
        /held in trust for art_ines/,
      );
    }
  });
  it("trust to creditors", () =>
    refused(
      s,
      () =>
        post(
          s,
          e([
            { account: ines, cents: -100 },
            { account: acct.creditors(G), cents: 100 },
          ]),
        ),
      /never creditors:gal_lowline/,
    ));
});

describe("journal: postTrustRelease() is narrow too", () => {
  const { s } = midSale(clockAt(AT));
  const ines = acct.trust(G, "art_ines");

  it("only the two trust codes", () =>
    refused(
      s,
      () =>
        postTrustRelease(
          s,
          e(
            [
              { account: ines, cents: -100 },
              { account: acct.artist(G, "art_ines"), cents: 100 },
            ],
            "TRANSFER",
          ),
        ),
      /must be TRUST_TO_ARTIST or TRUST_TO_BUYER/,
    ));
  it("never to operating, even with a trust code", () =>
    refused(
      s,
      () =>
        postTrustRelease(
          s,
          e(
            [
              { account: ines, cents: -100 },
              { account: acct.operating(G), cents: 100 },
            ],
            "TRUST_TO_ARTIST",
          ),
        ),
      /Artist trust can't pay operating/,
    ));
  it("never to another artist", () =>
    refused(
      s,
      () =>
        postTrustRelease(
          s,
          e(
            [
              { account: ines, cents: -100 },
              { account: acct.artist(G, "art_theo"), cents: 100 },
            ],
            "TRUST_TO_ARTIST",
          ),
        ),
      /trust only pays its own artist/,
    ));
  it("never more than the artist has in trust", () =>
    refused(
      s,
      () =>
        postTrustRelease(
          s,
          e(
            [
              { account: ines, cents: -800_001 },
              { account: acct.artist(G, "art_ines"), cents: 800_001 },
            ],
            "TRUST_TO_ARTIST",
          ),
        ),
      /below its floor of \$0\.00/,
    ));
  it("may only take money out of trust", () =>
    refused(
      s,
      () =>
        postTrustRelease(
          s,
          e(
            [
              { account: acct.operating(G), cents: -100 },
              { account: acct.buyer(G, "sale_x"), cents: 100 },
            ],
            "TRUST_TO_BUYER",
          ),
        ),
      /only take money out of trust/,
    ));
});

describe("journal: the rules are data", () => {
  it("trust has a floor of zero and only two exits", () => {
    expect(ACCOUNT_RULES.trust).toMatchObject({
      minBalance: 0,
      debitCodes: ["TRUST_TO_ARTIST", "TRUST_TO_BUYER"],
      debitTo: ["artist", "buyer"],
    });
    expect(ACCOUNT_RULES.operating.debitTo).not.toContain("trust");
  });

  it("entry() drops zero postings and returns null when nothing moves", () => {
    expect(
      entry("x", AT, "TRANSFER", [{ account: "a", cents: 0 }], null),
    ).toBeNull();
    expect(
      entry(
        "x",
        AT,
        "TRANSFER",
        [
          { account: "a", cents: 0 },
          { account: "b", cents: 3 },
          { account: "c", cents: -3 },
        ],
        null,
      )!.postings,
    ).toHaveLength(2);
  });
});

describe("journal: mirrors the records at every step", () => {
  it("the seed's journal folds to the seed's balances", () => {
    const s = createSeed();
    const bal = balancesOf(s.journal);
    expect(bal.get(acct.operating(G))).toBe(
      s.galleries[0].operatingBalanceCents,
    );
    expect(bal.get(acct.trust(G, "art_theo"))).toBe(240_000);
    expect(bal.get(acct.trust(G, "art_mara"))).toBe(0);
    expect(bal.get(acct.artist(G, "art_mara"))).toBe(900_000);
    expect(reconcile(s, G).breaks).toEqual([]);
  });

  it("zero-total operations post nothing and still succeed", () => {
    const clock = clockAt(AT);
    let s = applyTerms(
      createSeed(),
      {
        agreementId: "agr_ines",
        terms: FIXTURE_TERMS.agr_ines!,
        source: "fixture",
      },
      clock,
    );
    // Cancel a sale with no payments: nothing to refund.
    const a = createSale(
      s,
      { artworkId: "wrk_orchard", buyerName: "A", installments: 2 },
      clock,
    );
    const n = a.snapshot.journal.length;
    s = cancelSale(a.snapshot, { saleId: a.sale.id }, clock).snapshot;
    expect(s.journal).toHaveLength(n);
    // Insolvency twice: the second finds operating at 0 and is a no-op.
    s = declareInsolvency(s, { galleryId: G }, clock).snapshot;
    expect(declareInsolvency(s, { galleryId: G }, clock).snapshot).toBe(s);
    expect(reconcile(s, G).breaks).toEqual([]);
  });

  it("cancel after every share was paid on its deadline posts no trust refund", () => {
    const clock = clockAt(AT);
    const { s: mid, saleId } = midSale(clock);
    clock.advanceDays(61);
    const paid = releaseDueHolds(mid, clock);
    const s = cancelSale(paid, { saleId }, clock).snapshot;
    expect(s.journal.at(-1)!.code).toBe("OPERATING_TO_BUYER");
    expect(
      s.journal.some((x) => x.code === "TRUST_TO_BUYER" && x.ref === saleId),
    ).toBe(false);
    expect(reconcile(s, G).breaks).toEqual([]);
  });

  it("insolvency: creditors get operating through the journal, artists get trust", () => {
    const clock = clockAt(AT);
    const { s: mid } = midSale(clock);
    const s = declareInsolvency(mid, { galleryId: G }, clock).snapshot;
    const bal = balancesOf(s.journal);
    expect(bal.get(acct.creditors(G))).toBe(4_983_627);
    expect(bal.get(acct.operating(G))).toBe(0);
    expect(bal.get(acct.trust(G, "art_ines"))).toBe(0);
    expect(bal.get(acct.trust(G, "art_theo"))).toBe(0);
    expect(reconcile(s, G).breaks).toEqual([]);
  });
});
