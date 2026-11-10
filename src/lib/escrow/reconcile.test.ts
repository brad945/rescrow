// Planted-break catalogue: start from healthy books, corrupt them one way at a
// time, and check reconcile() names each corruption. A reconciliation that
// passes everything proves nothing; this proves each check can fail.
import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import {
  applyTerms,
  cancelSale,
  createSale,
  declareInsolvency,
  receivePayment,
  type Clock,
} from "./engine";
import { artistAccount, reconcile } from "./reconcile";

const G = "gal_lowline";

function clock(): Clock {
  let n = 0;
  return {
    now: () => "2026-11-10T15:00:00.000Z",
    id: (prefix) => `${prefix}_p${++n}`,
  };
}

/** Healthy books: Ines's sale with two of three payments in, one hold paid out earlier in the seed. */
function healthy(): Snapshot {
  const c = clock();
  let s = applyTerms(
    createSeed(),
    {
      agreementId: "agr_ines",
      terms: FIXTURE_TERMS.agr_ines!,
      source: "fixture",
    },
    c,
  );
  const { sale, snapshot } = createSale(
    s,
    { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
    c,
  );
  s = receivePayment(snapshot, { saleId: sale.id }, c).snapshot;
  s = receivePayment(s, { saleId: sale.id }, c).snapshot;
  return s;
}

const gallery = (s: Snapshot) => s.galleries.find((g) => g.id === G)!;
const locked = (s: Snapshot) => s.holds.find((h) => h.status === "locked")!;

const PLANTS: [string, (s: Snapshot) => void, RegExp][] = [
  [
    "a cent appears in operating",
    (s) => void (gallery(s).operatingBalanceCents += 1),
    /Operating balance is/,
  ],
  [
    "a cent vanishes from trust",
    (s) => void (locked(s).amountCents -= 1),
    /came in but/,
  ],
  [
    "trust holds more than the payment",
    (s) => {
      const h = locked(s);
      h.amountCents =
        s.payments.find((p) => p.id === h.paymentId)!.amountCents + 1;
    },
    /put more in trust than was received/,
  ],
  [
    "a payment loses its hold",
    (s) => {
      const h = locked(s);
      s.holds = s.holds.filter((x) => x !== h);
    },
    /has 0 trust holds, expected 1/,
  ],
  [
    "a payment gets two holds",
    (s) => void s.holds.push({ ...locked(s), id: "hold_dup", amountCents: 0 }),
    /has 2 trust holds, expected 1/,
  ],
  [
    "a hold is marked paid with no payout",
    (s) => void (locked(s).status = "paid"),
    /Payouts total .* but paid trust holds total/,
  ],
  [
    "a payout lists the same hold twice",
    (s) => {
      const p = s.payouts[0];
      p.holdIds = [...p.holdIds, p.holdIds[0]];
    },
    /more than one payout/,
  ],
  [
    "a payout is inflated",
    (s) => void (s.payouts[0].amountCents += 100),
    /Payouts total/,
  ],
  [
    "a payment is recorded that never split",
    (s) => void s.payments.push({ ...s.payments.at(-1)!, id: "pay_ghost" }),
    /pay_ghost has 0 trust holds/,
  ],
  [
    "operating goes negative",
    (s) => {
      const g = gallery(s);
      const shift = g.operatingBalanceCents + 1;
      g.operatingBalanceCents -= shift;
      g.openingBalanceCents = (g.openingBalanceCents ?? 0) - shift;
    },
    /Operating balance is negative/,
  ],
  [
    "a journal entry is edited after posting",
    (s) => void (s.journal.at(-1)!.postings[0].cents -= 1),
    /Journal entry .* sums to -1, not zero/,
  ],
  [
    "a journal entry is deleted",
    (s) => void s.journal.pop(),
    /Journal .* but the records say/,
  ],
  [
    "a balance is edited but the journal isn't",
    (s) => {
      const g = gallery(s);
      g.operatingBalanceCents += 500;
      g.openingBalanceCents = (g.openingBalanceCents ?? 0) + 500;
    },
    /Journal operating is .* but the records say/,
  ],
  [
    "trust for one artist is moved to another in the journal",
    (s) =>
      void s.journal.push({
        id: "je_plant",
        at: "2026-11-10T15:00:00.000Z",
        code: "TRANSFER",
        postings: [
          { account: "trust:gal_lowline:art_ines", cents: -100 },
          { account: "trust:gal_lowline:art_theo", cents: 100 },
        ],
        ref: null,
      }),
    /Journal trust for art_ines/,
  ],
  [
    "a refund record understates what came from trust",
    (s) => {
      const c = clock();
      const sale = s.sales.find(
        (x) => x.status === "open" && x.artworkId === "wrk_orchard",
      )!;
      const after = cancelSale(s, { saleId: sale.id }, c).snapshot;
      after.refunds[0].fromTrustCents -= 1;
      Object.assign(s, after);
    },
    /says .* came from trust, but refunded holds total/,
  ],
  [
    "a cancelled sale loses its refund record",
    (s) => {
      const sale = s.sales.find(
        (x) => x.status === "open" && x.artworkId === "wrk_orchard",
      )!;
      const after = cancelSale(s, { saleId: sale.id }, clock()).snapshot;
      after.refunds = [];
      Object.assign(s, after);
    },
    /has 0 refund records, expected 1/,
  ],
  [
    "two payments share a bank transaction id",
    (s) => {
      const [a, b] = s.payments.slice(-2);
      b.rampTransactionId = a.rampTransactionId;
    },
    /was booked 2 times/,
  ],
  [
    "a payment has no bank transaction id",
    (s) => void delete s.payments.at(-1)!.rampTransactionId,
    /has no bank transaction id/,
  ],
  [
    "one cent shifted between two of Ines's holds (every total still balances)",
    (s) => {
      const [a, b] = s.holds.filter((h) => h.artistId === "art_ines");
      a.amountCents += 1;
      b.amountCents -= 1;
    },
    /Payment 1 on .* put \$4,000\.01 in trust; its running-total share is \$4,000\.00/,
  ],
  [
    "a locked hold is left on a completed sale",
    (s) => {
      const h = s.holds.find((x) => x.saleId === "sale_tidewater")!;
      h.status = "locked";
      s.payouts = s.payouts.filter((p) => !p.holdIds.includes(h.id));
    },
    /still locked in trust on paid sale sale_tidewater/,
  ],
  [
    "a hold is relabelled to another artist",
    (s) => void (locked(s).artistId = "art_mara"),
    /doesn't match its sale's artist or gallery/,
  ],
  [
    "a payout includes another artist's hold",
    (s) => {
      const mara = s.payouts.find((p) => p.artistId === "art_mara")!;
      mara.artistId = "art_theo";
    },
    /pays art_theo from another artist's hold/,
  ],
  [
    "a payout differs from its holds by one cent",
    (s) => void (s.payouts[0].amountCents += 1),
    /Payout po_tidewater is \$9,000\.01 but its holds total \$9,000\.00/,
  ],
  [
    "two receipt entries edited to offset each other (every balance unchanged)",
    (s) => {
      const [a, b] = s.journal.filter(
        (e) =>
          e.code === "RECEIPT_SPLIT" &&
          e.postings.some((p) => p.account.endsWith("art_ines")),
      );
      const shift = (e: typeof a, cents: number) => {
        e.postings.find((p) => p.account.startsWith("operating:"))!.cents -=
          cents;
        e.postings.find((p) => p.account.startsWith("trust:"))!.cents += cents;
      };
      shift(a, 100);
      shift(b, -100);
    },
    /Journal entry .* doesn't match payment/,
  ],
  [
    "the opening balance is missing",
    (s) => void delete gallery(s).openingBalanceCents,
    /No opening balance on record/,
  ],
];

describe("reconcile: planted-break catalogue", () => {
  it("the unplanted books balance", () => {
    expect(reconcile(healthy(), G).breaks).toEqual([]);
  });

  it.each(PLANTS)("catches: %s", (_name, plant, expected) => {
    const s = structuredClone(healthy());
    plant(s);
    const r = reconcile(s, G);
    expect(r.balanced).toBe(false);
    expect(r.breaks.join("\n")).toMatch(expected);
  });

  it("still catches a planted break after insolvency", () => {
    const s = declareInsolvency(healthy(), { galleryId: G }, clock()).snapshot;
    expect(reconcile(s, G).balanced).toBe(true);
    s.payouts.at(-1)!.amountCents -= 1;
    expect(reconcile(s, G).balanced).toBe(false);
  });
});

describe("artistAccount: one artist's own books, from three sources", () => {
  it("agrees for every artist on healthy books, before and after insolvency", () => {
    for (const s of [
      createSeed(),
      healthy(),
      declareInsolvency(healthy(), { galleryId: G }, clock()).snapshot,
    ]) {
      for (const a of ["art_mara", "art_theo", "art_ines"]) {
        const acc = artistAccount(s, G, a);
        expect(acc.agrees, a).toBe(true);
        expect(acc.journalAgrees, a).toBe(true);
      }
    }
    expect(artistAccount(healthy(), G, "art_ines")).toMatchObject({
      shareReceivedCents: 800_000,
      heldCents: 800_000,
      paidCents: 0,
    });
  });

  it("disagrees when one of the artist's holds is deleted or resized", () => {
    const gone = structuredClone(healthy());
    const first = gone.holds.find((h) => h.artistId === "art_ines")!;
    gone.holds = gone.holds.filter((h) => h !== first);
    expect(artistAccount(gone, G, "art_ines").agrees).toBe(false);

    const resized = structuredClone(healthy());
    resized.holds.find((h) => h.artistId === "art_ines")!.amountCents -= 1;
    expect(artistAccount(resized, G, "art_ines").agrees).toBe(false);
  });

  it("the journal side disagrees when an artist posting is edited", () => {
    const s = structuredClone(healthy());
    const e = s.journal.find((x) =>
      x.postings.some((p) => p.account === "artist:gal_lowline:art_mara"),
    )!;
    e.postings.find(
      (p) => p.account === "artist:gal_lowline:art_mara",
    )!.cents -= 1;
    expect(artistAccount(s, G, "art_mara").journalAgrees).toBe(false);
  });
});
