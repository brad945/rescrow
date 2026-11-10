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
import { insolvencyOutcome } from "./insolvency";

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
