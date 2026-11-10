import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import {
  advanceClock,
  applyTerms,
  createSale,
  declareInsolvency,
  receivePayment,
  type Clock,
} from "@/lib/escrow/engine";
import { balancesOf } from "@/lib/escrow/journal";
import { glLines, trialBalance } from "@/lib/books";
import { artistPayments } from "@/lib/artist";
import {
  artistAtFailure,
  insolvencyOutcome,
  statementOfAffairs,
} from "./insolvency";

const G = "gal_lowline";
function clock(): Clock {
  let n = 0;
  return { now: () => "2026-11-10T15:00:00.000Z", id: (p) => `${p}_i${++n}` };
}

function storyAfterTwoPayments(c: Clock): Snapshot {
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
  return receivePayment(s, { saleId: sale.id }, c).snapshot;
}

/** Operating plus artist trust in the journal, just before creditors were paid. */
function journalBeforeFailure(s: Snapshot): number {
  const i = s.journal.findIndex((e) => e.code === "OPERATING_TO_CREDITORS");
  const bal = balancesOf(s.journal.slice(0, i));
  return [...bal]
    .filter(([a]) => a === `operating:${G}` || a.startsWith(`trust:${G}:`))
    .reduce((t, [, c]) => t + c, 0);
}

describe("insolvencyOutcome", () => {
  it("is null while the gallery is trading", () => {
    expect(insolvencyOutcome(createSeed(), G)).toBeNull();
  });

  it("on the story take: creditors, artists, returned works, and the counterfactual", () => {
    const c = clock();
    const s = declareInsolvency(
      storyAfterTwoPayments(c),
      { galleryId: G },
      c,
    ).snapshot;
    const o = insolvencyOutcome(s, G)!;
    expect(o.toCreditorsCents).toBe(4_983_627);
    const paid = (a: string) =>
      o.toArtists
        .filter((x) => x.artistId === a)
        .reduce((t, x) => t + x.amountCents, 0);
    expect(paid("art_ines")).toBe(800_000);
    expect(paid("art_theo")).toBe(240_000);
    expect(o.commingledCents).toBe(o.toCreditorsCents + 1_040_000);
    expect(o.worksReturned.length).toBeGreaterThan(0);
    expect(s.artworks.filter((w) => w.status === "consigned")).toEqual([]);
    // A second, independent source: the journal just before the failure.
    expect(o.commingledCents).toBe(journalBeforeFailure(s));
    expect(insolvencyOutcome(s, G)).toEqual(o);
  });

  it("a share already paid on its deadline is not in the frozen balance", () => {
    const c = clock();
    let s = advanceClock(storyAfterTwoPayments(c), { days: 5 }, c); // Theo's 14-day share falls due
    s = declareInsolvency(s, { galleryId: G }, c).snapshot;
    const o = insolvencyOutcome(s, G)!;
    expect(o.toArtists.some((a) => a.artistId === "art_theo")).toBe(false);
    expect(o.commingledCents).toBe(journalBeforeFailure(s));
  });
});

describe("statementOfAffairs", () => {
  const deposits = (s: Snapshot) =>
    trialBalance(glLines(s, G)).rows.find((r) => r.account.code === "2020")!
      .balanceCents;

  it("is null while the gallery is trading", () => {
    expect(statementOfAffairs(createSeed(), G)).toBeNull();
  });

  it("the story take: every open sale split, tied to the journal and the GL", () => {
    const c = clock();
    const s = declareInsolvency(
      storyAfterTwoPayments(c),
      { galleryId: G },
      c,
    ).snapshot;
    const st = statementOfAffairs(s, G)!;
    const row = (title: string) =>
      st.openSales.find((r) => r.workTitle === title)!;
    expect(row("Orchard in Rain")).toMatchObject({
      paidCents: 1_600_000,
      paidOnDeadlineCents: 0,
      paidAtFailureCents: 800_000,
      buyerClaimCents: 800_000,
    });
    expect(row("Four Lamps")).toMatchObject({
      paidCents: 400_000,
      paidOnDeadlineCents: 0,
      paidAtFailureCents: 240_000,
      buyerClaimCents: 160_000,
    });
    for (const r of st.openSales) {
      expect(r.paidCents).toBe(
        r.paidOnDeadlineCents + r.paidAtFailureCents + r.buyerClaimCents,
      );
    }
    expect(st.openSales.reduce((t, r) => t + r.paidAtFailureCents, 0)).toBe(
      st.outcome.artistsShareOfCommingledCents,
    );
    expect(st.buyerClaimsCents).toBe(deposits(s));
    expect(st.estateCashCents + st.outcome.artistsShareOfCommingledCents).toBe(
      journalBeforeFailure(s),
    );
    const returned = st.outcome.worksReturned.map((w) => w.title);
    expect(returned).not.toContain("Orchard in Rain");
    expect(returned).not.toContain("Four Lamps");
    for (const t of st.trustPaidOut)
      expect(t.bankIds.length).toBeGreaterThan(0);
  });

  it("deadline payouts before the failure land in their own column", () => {
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
    s = advanceClock(s, { days: 61 }, c);
    s = declareInsolvency(s, { galleryId: G }, c).snapshot;
    const st = statementOfAffairs(s, G)!;
    const row = (title: string) =>
      st.openSales.find((r) => r.workTitle === title)!;
    expect(row("Four Lamps")).toMatchObject({
      paidCents: 400_000,
      paidOnDeadlineCents: 240_000,
      paidAtFailureCents: 0,
      buyerClaimCents: 160_000,
    });
    expect(row("Orchard in Rain")).toMatchObject({
      paidCents: 800_000,
      paidOnDeadlineCents: 400_000,
      paidAtFailureCents: 0,
      buyerClaimCents: 400_000,
    });
    expect(st.buyerClaimsCents).toBe(deposits(s));
    expect(st.outcome.artistsShareOfCommingledCents).toBe(0);
  });
});

describe("artistAtFailure", () => {
  it("is null while the gallery trades", () => {
    expect(artistAtFailure(createSeed(), "art_ines")).toBeNull();
  });

  it("Ines after B: $8,000 from trust, funded by two bank payments, works accounted for", () => {
    const c = clock();
    const s = declareInsolvency(
      storyAfterTwoPayments(c),
      { galleryId: G },
      c,
    ).snapshot;
    const a = artistAtFailure(s, "art_ines")!;
    expect(a.paidAtFailure.reduce((t, p) => t + p.amountCents, 0)).toBe(
      800_000,
    );
    expect(a.paidAtFailure.flatMap((p) => p.paymentIds)).toHaveLength(2);
    expect(a.worksUnderOpenSale.map((w) => w.workTitle)).toEqual([
      "Orchard in Rain",
    ]);
    expect(a.worksReturned.map((w) => w.title)).toContain("Threshold");
    // Cross-check against the artist timeline, a separate path over the same records.
    const viaTimeline = artistPayments(s, "art_ines")
      .filter((r) => r.how === "insolvency")
      .reduce((t, r) => t + r.shareCents, 0);
    expect(viaTimeline).toBe(800_000);
  });
});

describe("an open sale with nothing paid yet, at the failure", () => {
  it("is listed under open sales and on the artist's failure card", () => {
    const c = clock();
    let s = storyAfterTwoPayments(c);
    s = createSale(
      s,
      { artworkId: "wrk_salt", buyerName: "Y", installments: 2 },
      c,
    ).snapshot;
    s = declareInsolvency(s, { galleryId: G }, c).snapshot;
    const salt = statementOfAffairs(s, G)!.openSales.find(
      (r) => r.workTitle === "Salt Study No. 4",
    )!;
    expect(salt).toMatchObject({ paidCents: 0, buyerClaimCents: 0 });
    const mara = artistAtFailure(s, "art_mara")!;
    expect(mara.worksUnderOpenSale.map((w) => w.workTitle)).toEqual([
      "Salt Study No. 4",
    ]);
  });
});
