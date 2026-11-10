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
import { SEED_NOW } from "@/lib/seed";
import {
  deadlineLadder,
  flowMatrix,
  glLines,
  incomeStatement,
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

  it("commission is a buyer deposit (2020) until the sale completes, then revenue (4010)", () => {
    const part = (s: Snapshot, saleId: string) =>
      s.payments
        .filter((p) => p.saleId === saleId)
        .reduce((t, p) => {
          const h = s.holds.find((x) => x.paymentId === p.id)!;
          return t + p.amountCents - h.amountCents;
        }, 0);
    for (const s of steps) {
      const tb = trialBalance(glLines(s, G));
      const row = (code: string) =>
        tb.rows.find((r) => r.account.code === code)!.balanceCents;
      const open = s.sales.filter((x) => x.status === "open");
      const done = s.sales.filter((x) => x.status === "paid");
      expect(row("2020")).toBe(open.reduce((t, x) => t + part(s, x.id), 0));
      expect(row("4010")).toBe(done.reduce((t, x) => t + part(s, x.id), 0));
    }
  });

  it("a completing receipt's GL lines never change later (exports stay stable)", () => {
    const mid = steps[4];
    const last = steps.at(-1)!;
    const ids = new Set(mid.journal.map((e) => e.id));
    const at = (s: Snapshot) => glLines(s, G).filter((l) => ids.has(l.entryId));
    expect(at(last)).toEqual(at(mid));
  });

  it("a cancelled sale nets to zero in buyer deposits", () => {
    const s = steps.at(-2)!; // after the covered cancel, before insolvency
    const cancelled = s.sales.find((x) => x.status === "cancelled")!;
    const payIds = new Set(
      s.payments.filter((p) => p.saleId === cancelled.id).map((p) => p.id),
    );
    const entries = new Set(
      s.journal
        .filter((e) => (e.ref && payIds.has(e.ref)) || e.ref === cancelled.id)
        .map((e) => e.id),
    );
    const net = glLines(s, G)
      .filter((l) => l.account === "2020" && entries.has(l.entryId))
      .reduce((t, l) => t + l.creditCents - l.debitCents, 0);
    expect(net).toBe(0);
  });

  it("cash minus accrual commission is exactly what is still held as deposits", () => {
    for (const s of steps) {
      const lines = glLines(s, G);
      const deposits = trialBalance(lines).rows.find(
        (r) => r.account.code === "2020",
      )!.balanceCents;
      expect(
        incomeStatement(lines, "cash").commissionCents -
          incomeStatement(lines, "accrual").commissionCents,
      ).toBe(deposits);
    }
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

describe("books: payout deadline ladder", () => {
  const plus = (days: number) =>
    new Date(Date.parse(SEED_NOW) + days * 86_400_000).toISOString();

  it("Theo's seeded share is due within 7 days, then overdue, then paid", () => {
    const s = createSeed();
    const at0 = deadlineLadder(s, G, SEED_NOW);
    expect(at0.rows).toHaveLength(1);
    expect(at0.rows[0]).toMatchObject({
      bucket: "within 7 days",
      daysLeft: 4,
      source: "14 days from receipt, fixed on the sale",
    });
    expect(deadlineLadder(s, G, plus(5)).totals.overdue).toBe(240_000);
    const c = { now: () => plus(5), id: (p: string) => `${p}_l` };
    const paid = releaseDueHolds(s, c);
    expect(deadlineLadder(paid, G, plus(5)).totals.overdue).toBe(0);
  });

  it("bucket totals always equal what is in trust", () => {
    for (const s of history()) {
      const { totals } = deadlineLadder(s, G, "2026-11-10T15:00:00.000Z");
      const sum = Object.values(totals).reduce((a, b) => a + b, 0);
      expect(sum).toBe(reconcile(s, G).trustCents);
    }
  });

  it("a hold with no deadline is listed as such, never as 'later'", () => {
    const s = createSeed();
    delete s.holds.find((h) => h.status === "locked")!.dueBy;
    expect(deadlineLadder(s, G, SEED_NOW).rows[0].bucket).toBe(
      "no deadline on record",
    );
  });
});
