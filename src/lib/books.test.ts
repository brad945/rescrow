import { describe, expect, it } from "vitest";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import {
  applyTerms,
  cancelSale,
  createSale,
  declareInsolvency,
  receivePayment,
  releaseDueHolds,
  type Clock,
} from "@/lib/escrow/engine";
import { reconcile } from "@/lib/escrow/reconcile";
import {
  flowMatrix,
  glLines,
  toCsv,
  toQuickBooksJson,
  trialBalance,
  trustTieOut,
} from "./books";

const G = "gal_lowline";

function clock(): Clock & { advanceDays: (d: number) => void } {
  let t = Date.parse("2026-11-10T15:00:00.000Z");
  let n = 0;
  return {
    now: () => new Date(t).toISOString(),
    id: (p) => `${p}_b${++n}`,
    advanceDays: (d) => (t += d * 86_400_000),
  };
}

/** The demo, step by step, plus a deadline payout and a covered refund. */
function history(): Snapshot[] {
  const c = clock();
  const out: Snapshot[] = [createSeed()];
  const push = (s: Snapshot) => (out.push(s), s);
  let s = push(
    applyTerms(
      out[0],
      {
        agreementId: "agr_ines",
        terms: FIXTURE_TERMS.agr_ines!,
        source: "fixture",
      },
      c,
    ),
  );
  s = push(
    applyTerms(
      s,
      {
        agreementId: "agr_mara",
        terms: FIXTURE_TERMS.agr_mara!,
        source: "fixture",
      },
      c,
    ),
  );
  const a = createSale(
    s,
    { artworkId: "wrk_orchard", buyerName: "M", installments: 3 },
    c,
  );
  s = push(receivePayment(a.snapshot, { saleId: a.sale.id }, c).snapshot);
  s = push(receivePayment(s, { saleId: a.sale.id }, c).snapshot);
  const b = createSale(
    s,
    { artworkId: "wrk_salt", buyerName: "Y", installments: 2 },
    c,
  );
  s = push(receivePayment(b.snapshot, { saleId: b.sale.id }, c).snapshot);
  c.advanceDays(70);
  s = push(releaseDueHolds(s, c)); // deadline payouts
  s = push(cancelSale(s, { saleId: b.sale.id }, c).snapshot); // covered refund
  push(declareInsolvency(s, { galleryId: G }, c).snapshot);
  return out;
}

describe("books: general ledger from the journal", () => {
  const steps = history();

  it("every GL entry balances, and the trial balance balances at every step", () => {
    for (const s of steps) {
      const lines = glLines(s, G);
      const byEntry = new Map<string, number>();
      for (const l of lines) {
        byEntry.set(
          l.entryId,
          (byEntry.get(l.entryId) ?? 0) + l.debitCents - l.creditCents,
        );
      }
      for (const [id, net] of byEntry) expect(net, id).toBe(0);
      expect(trialBalance(lines).balanced).toBe(true);
      expect(reconcile(s, G).breaks).toEqual([]);
    }
  });

  it("trust ties out: restricted cash = due to artists = locked holds, at every step", () => {
    for (const s of steps) {
      const t = trustTieOut(s, G);
      expect(t.ok).toBe(true);
      const locked = s.holds
        .filter((h) => h.status === "locked")
        .reduce((a, h) => a + h.amountCents, 0);
      expect(t.restrictedCashCents).toBe(locked);
      expect(t.dueToArtistsCents).toBe(locked);
    }
  });

  it("the ledger accounts match the engine's own balances", () => {
    const s = steps.at(-1)!;
    const tb = trialBalance(glLines(s, G));
    const row = (code: string) =>
      tb.rows.find((r) => r.account.code === code)!.balanceCents;
    expect(row("1010")).toBe(s.galleries[0].operatingBalanceCents); // 0 after insolvency
    expect(row("1020")).toBe(0);
    expect(row("3900")).toBe(s.galleries[0].claimedByCreditorsCents);
    expect(row("5010")).toBe(
      s.refunds.reduce((a, r) => a + r.coveredByGalleryCents, 0),
    );
    expect(row("5010")).toBeGreaterThan(0);
  });

  it("a hold edited in the records, but not in the journal, breaks the tie-out and the coverage", () => {
    const s = structuredClone(steps[4]);
    const h = s.holds.find((x) => x.status === "locked")!;
    h.amountCents -= 100;
    const t = trustTieOut(s, G);
    expect(t.ok).toBe(false);
    expect(t.restrictedCashCents).toBe(t.dueToArtistsCents - 100);
    expect(t.coverageBps).toBeLessThan(10_000);
  });

  it("a planted extra cent in trust breaks the tie-out", () => {
    const s = structuredClone(steps[3]);
    s.journal[s.journal.length - 1].postings.find((p) =>
      p.account.startsWith("trust:"),
    )!.cents += 1;
    expect(trustTieOut(s, G).ok).toBe(false);
  });
});

describe("books: exports", () => {
  const s = history().at(-1)!;
  const lines = glLines(s, G);

  it("CSV: one row per GL line, debits equal credits to the cent", () => {
    const csv = toCsv(s, lines);
    const rows = csv.trim().split("\n");
    expect(rows[0]).toBe(
      "Date,Entry,Account,Account name,Artist,Debit,Credit,Memo",
    );
    expect(rows).toHaveLength(lines.length + 1);
    const cents = (v: string) => (v ? Math.round(Number(v) * 100) : 0);
    let dr = 0;
    let cr = 0;
    for (const r of rows.slice(1)) {
      const cells = r
        .match(/("([^"]|"")*"|[^,]*)(,|$)/g)!
        .map((c) => c.replace(/,$/, ""));
      dr += cents(cells[5]);
      cr += cents(cells[6]);
    }
    expect(dr).toBe(cr);
    expect(dr).toBe(trialBalance(lines).debitCents);
  });

  it("QuickBooks JSON: one entry per journal entry, amounts as exact decimals, stable", () => {
    const json = toQuickBooksJson(lines);
    expect(toQuickBooksJson(lines)).toBe(json);
    const parsed = JSON.parse(json) as {
      JournalEntry: { DocNumber: string; Line: { Amount: string }[] }[];
    };
    expect(new Set(parsed.JournalEntry.map((e) => e.DocNumber)).size).toBe(
      parsed.JournalEntry.length,
    );
    for (const e of parsed.JournalEntry) {
      for (const l of e.Line) expect(l.Amount).toMatch(/^\d+\.\d{2}$/);
    }
  });
});

describe("books: the flow matrix comes from the journal's own rules", () => {
  const cell = (from: string, to: string) =>
    flowMatrix().find((c) => c.from === from && c.to === to)!;

  it("trust can only reach the artist or the buyer", () => {
    expect(cell("trust", "artist")).toMatchObject({
      allowed: true,
      detail: "TRUST_TO_ARTIST",
    });
    expect(cell("trust", "buyer").detail).toBe("TRUST_TO_BUYER");
    expect(cell("trust", "buyer").allowed).toBe(true);
    expect(cell("trust", "operating").allowed).toBe(false);
    expect(cell("trust", "creditors").allowed).toBe(false);
  });

  it("operating can refund buyers and go to creditors, but can't reach artists or trust", () => {
    expect(cell("operating", "buyer").allowed).toBe(true);
    expect(cell("operating", "creditors").allowed).toBe(true);
    expect(cell("operating", "artist").allowed).toBe(false);
    expect(cell("operating", "trust").allowed).toBe(false);
  });
});
