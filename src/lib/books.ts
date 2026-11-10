// The gallery's books, for its accountant.
//
// A read-only view built from the journal: every journal entry becomes a
// balanced general-ledger (GL) entry on a small chart of accounts, in which
// money held for artists is restricted cash owed to them (a liability), never
// revenue. Nothing here posts or changes state.
//
// The gallery is an agent: its commission is earned when a sale completes.
// Until then its part of each installment is the buyer's deposit (2020); the
// receipt that completes the sale recognises all of it as commission (4010),
// and a cancelled sale hands the deposit back from 2020.
import type { Cents, Id, JournalCode, Snapshot } from "@/types";
import { formatCents } from "@/lib/money";
import {
  ACCOUNT_RULES,
  parseAccount,
  rejections,
  type AccountKind,
} from "@/lib/escrow/journal";

export interface GlAccount {
  code: string;
  name: string;
  /** Which side increases the account. */
  normal: "debit" | "credit";
  kind: "asset" | "liability" | "equity" | "revenue" | "expense";
}

export const CHART: Record<string, GlAccount> = {
  "1010": {
    code: "1010",
    name: "Operating cash",
    normal: "debit",
    kind: "asset",
  },
  "1020": {
    code: "1020",
    name: "Restricted cash, artist trust",
    normal: "debit",
    kind: "asset",
  },
  "2010": {
    code: "2010",
    name: "Due to artists",
    normal: "credit",
    kind: "liability",
  },
  "2020": {
    code: "2020",
    name: "Buyer deposits, gallery part",
    normal: "credit",
    kind: "liability",
  },
  "3000": {
    code: "3000",
    name: "Opening equity",
    normal: "credit",
    kind: "equity",
  },
  "3900": {
    code: "3900",
    name: "Turned over to administrator",
    normal: "debit",
    kind: "equity",
  },
  "4010": {
    code: "4010",
    name: "Commission revenue",
    normal: "credit",
    kind: "revenue",
  },
  "5010": {
    code: "5010",
    name: "Refunds covered for artists",
    normal: "debit",
    kind: "expense",
  },
};

export interface GlLine {
  entryId: Id;
  at: string;
  code: JournalCode;
  account: string;
  /** Artist sub-ledger, for 1020 and 2010 lines. */
  artistId: Id | null;
  debitCents: Cents;
  creditCents: Cents;
  memo: string;
}

/** Turns each journal entry for the gallery into balanced GL lines. */
export function glLines(s: Snapshot, galleryId: Id): GlLine[] {
  const lines: GlLine[] = [];
  const artistName = (id: Id | null) =>
    s.artists.find((a) => a.id === id)?.name ?? id ?? "";

  for (const e of s.journal) {
    const parts = e.postings.map((p) => ({
      ...parseAccount(p.account),
      cents: p.cents,
    }));
    if (!parts.some((p) => p.gallery === galleryId)) continue;
    const add = (
      account: string,
      side: "debit" | "credit",
      cents: Cents,
      memo: string,
      artistId: Id | null = null,
    ) => {
      if (cents === 0) return;
      lines.push({
        entryId: e.id,
        at: e.at,
        code: e.code,
        account,
        artistId,
        debitCents: side === "debit" ? cents : 0,
        creditCents: side === "credit" ? cents : 0,
        memo,
      });
    };
    const of = (kind: AccountKind) => parts.filter((p) => p.kind === kind);
    const total = (kind: AccountKind) =>
      of(kind).reduce((t, p) => t + p.cents, 0);

    switch (e.code) {
      case "OPENING":
        add("1010", "debit", total("operating"), "Opening operating balance");
        add("3000", "credit", total("operating"), "Opening operating balance");
        break;
      case "RECEIPT_SPLIT": {
        const part = total("operating");
        add("1010", "debit", part, "Buyer payment, gallery part");
        add(
          "2020",
          "credit",
          part,
          "Held as the buyer's deposit until the sale completes",
        );
        // The receipt that completes its sale recognises the whole
        // commission. Decided from the running total up to this payment, so
        // a GL entry never changes after it is posted.
        const earned = commissionCompletedBy(s, e.ref);
        if (earned > 0) {
          add(
            "2020",
            "debit",
            earned,
            "Sale complete: deposit becomes commission",
          );
          add("4010", "credit", earned, "Commission earned, sale complete");
        }
        for (const t of of("trust")) {
          add(
            "1020",
            "debit",
            t.cents,
            `Held for ${artistName(t.party)}`,
            t.party,
          );
          add(
            "2010",
            "credit",
            t.cents,
            `Owed to ${artistName(t.party)}`,
            t.party,
          );
        }
        break;
      }
      case "TRUST_TO_ARTIST":
      case "TRUST_TO_BUYER":
        for (const t of of("trust")) {
          const memo =
            e.code === "TRUST_TO_ARTIST"
              ? `Paid to ${artistName(t.party)} from trust`
              : `Refunded to buyer from ${artistName(t.party)}'s trust`;
          add("2010", "debit", -t.cents, memo, t.party);
          add("1020", "credit", -t.cents, memo, t.party);
        }
        break;
      case "OPERATING_TO_BUYER": {
        const out = -total("operating");
        const covered =
          s.refunds.find((r) => r.saleId === e.ref)?.coveredByGalleryCents ?? 0;
        add(
          "2020",
          "debit",
          out - covered,
          "Buyer's deposit returned, sale cancelled",
        );
        add("5010", "debit", covered, "Gallery covers a share the artist kept");
        add("1010", "credit", out, "Refund to buyer from operating");
        break;
      }
      case "OPERATING_TO_CREDITORS":
        add(
          "3900",
          "debit",
          -total("operating"),
          "Operating cash to the administrator",
        );
        add(
          "1010",
          "credit",
          -total("operating"),
          "Operating cash to the administrator",
        );
        break;
      case "TRANSFER":
        // Never posts: the account rules refuse it. Nothing to show.
        break;
    }
  }
  return lines;
}

/**
 * If payment `paymentId` completes its sale (the running total of that sale's
 * payments, in recorded order, reaches the price), the gallery's part of all
 * of them; otherwise 0.
 */
function commissionCompletedBy(s: Snapshot, paymentId: Id | null): Cents {
  const payment = s.payments.find((p) => p.id === paymentId);
  const sale = payment && s.sales.find((x) => x.id === payment.saleId);
  if (!payment || !sale) return 0;
  const all = s.payments.filter((p) => p.saleId === sale.id);
  const prefix = all.slice(0, all.findIndex((p) => p.id === payment.id) + 1);
  if (prefix.reduce((t, p) => t + p.amountCents, 0) !== sale.priceCents)
    return 0;
  return prefix.reduce((t, p) => {
    const hold = s.holds.find((h) => h.paymentId === p.id);
    return t + p.amountCents - (hold?.amountCents ?? 0);
  }, 0);
}

export interface IncomeStatement {
  basis: "accrual" | "cash";
  commissionCents: Cents;
  coveredRefundsCents: Cents;
  netCents: Cents;
}

/**
 * Commission earned, on either basis, from the same GL lines. Accrual: what
 * was recognised when sales completed (4010). Cash: the gallery's part of
 * buyer money received, less what was handed back on cancellations. Refunds
 * the gallery covered for artists (5010) are an expense on both.
 */
export function incomeStatement(
  lines: GlLine[],
  basis: "accrual" | "cash",
): IncomeStatement {
  const sum = (
    pred: (l: GlLine) => boolean,
    side: "debitCents" | "creditCents",
  ) => lines.filter(pred).reduce((t, l) => t + l[side], 0);
  const commissionCents =
    basis === "accrual"
      ? sum((l) => l.account === "4010", "creditCents") -
        sum((l) => l.account === "4010", "debitCents")
      : sum(
          (l) => l.account === "2020" && l.code === "RECEIPT_SPLIT",
          "creditCents",
        ) -
        sum(
          (l) => l.account === "2020" && l.code === "OPERATING_TO_BUYER",
          "debitCents",
        );
  const coveredRefundsCents = sum((l) => l.account === "5010", "debitCents");
  return {
    basis,
    commissionCents,
    coveredRefundsCents,
    netCents: commissionCents - coveredRefundsCents,
  };
}

export interface TrialBalanceRow {
  account: GlAccount;
  debitCents: Cents;
  creditCents: Cents;
  /** Balance on the account's normal side (negative if the other way). */
  balanceCents: Cents;
}

export function trialBalance(lines: GlLine[]): {
  rows: TrialBalanceRow[];
  debitCents: Cents;
  creditCents: Cents;
  balanced: boolean;
} {
  const rows = Object.values(CHART).map((account) => {
    const mine = lines.filter((l) => l.account === account.code);
    const debitCents = mine.reduce((t, l) => t + l.debitCents, 0);
    const creditCents = mine.reduce((t, l) => t + l.creditCents, 0);
    const balanceCents =
      account.normal === "debit"
        ? debitCents - creditCents
        : creditCents - debitCents;
    return { account, debitCents, creditCents, balanceCents };
  });
  const debitCents = lines.reduce((t, l) => t + l.debitCents, 0);
  const creditCents = lines.reduce((t, l) => t + l.creditCents, 0);
  return {
    rows,
    debitCents,
    creditCents,
    balanced: debitCents === creditCents,
  };
}

export interface TieOut {
  /** Restricted trust cash per the engine's records: the shares it holds. */
  restrictedCashCents: Cents;
  /** Due to artists per the general ledger, built from the journal. */
  dueToArtistsCents: Cents;
  perArtist: {
    artistId: Id;
    owedCents: Cents;
    lockedCents: Cents;
    ok: boolean;
  }[];
  ok: boolean;
  /** Restricted cash as a share of what is owed, in basis points (10000 = fully covered). */
  coverageBps: number;
}

/**
 * The balance-sheet check an accountant would make, from two independent
 * sources: restricted trust cash as the engine's records hold it (its locked
 * shares) against what the general ledger, built from the journal, says is
 * due to artists. In total and artist by artist. (Within the GL itself, 1020
 * and 2010 move together by construction, so comparing them to each other
 * would prove nothing.)
 */
export function trustTieOut(s: Snapshot, galleryId: Id): TieOut {
  const lines = glLines(s, galleryId);
  const owed = (artistId?: Id) =>
    lines
      .filter(
        (l) =>
          l.account === "2010" &&
          (artistId === undefined || l.artistId === artistId),
      )
      .reduce((t, l) => t + l.creditCents - l.debitCents, 0);
  const locked = (artistId?: Id) =>
    s.holds
      .filter(
        (h) =>
          h.galleryId === galleryId &&
          h.status === "locked" &&
          (artistId === undefined || h.artistId === artistId),
      )
      .reduce((t, h) => t + h.amountCents, 0);
  const restrictedCashCents = locked();
  const dueToArtistsCents = owed();
  const artists = new Set([
    ...lines.filter((l) => l.artistId).map((l) => l.artistId!),
    ...s.holds.filter((h) => h.galleryId === galleryId).map((h) => h.artistId),
  ]);
  const perArtist = [...artists].sort().map((artistId) => {
    const owedCents = owed(artistId);
    const lockedCents = locked(artistId);
    return { artistId, owedCents, lockedCents, ok: owedCents === lockedCents };
  });
  const ok =
    restrictedCashCents === dueToArtistsCents && perArtist.every((a) => a.ok);
  const coverageBps =
    dueToArtistsCents === 0
      ? restrictedCashCents === 0
        ? 10_000
        : 0
      : Math.floor((restrictedCashCents * 10_000) / dueToArtistsCents);
  return { restrictedCashCents, dueToArtistsCents, perArtist, ok, coverageBps };
}

// Exports. Amounts leave as exact decimal strings built from integer cents,
// never through floating point.

function decimal(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(s: Snapshot, lines: GlLine[]): string {
  const name = (id: Id | null) =>
    s.artists.find((a) => a.id === id)?.name ?? "";
  const rows = [
    [
      "Date",
      "Entry",
      "Account",
      "Account name",
      "Artist",
      "Debit",
      "Credit",
      "Memo",
    ],
    ...lines.map((l) => [
      l.at.slice(0, 10),
      l.entryId,
      l.account,
      CHART[l.account].name,
      name(l.artistId),
      l.debitCents ? decimal(l.debitCents) : "",
      l.creditCents ? decimal(l.creditCents) : "",
      l.memo,
    ]),
  ];
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/**
 * QuickBooks Online-style journal entries. DocNumber is the journal entry id,
 * so importing the same file twice can be deduplicated on it.
 */
export function toQuickBooksJson(lines: GlLine[]): string {
  const byEntry = new Map<Id, GlLine[]>();
  for (const l of lines)
    byEntry.set(l.entryId, [...(byEntry.get(l.entryId) ?? []), l]);
  const entries = [...byEntry].map(([id, ls]) => ({
    DocNumber: id,
    TxnDate: ls[0].at.slice(0, 10),
    PrivateNote: ls[0].code,
    Line: ls.map((l) => ({
      Description: l.memo,
      Amount: decimal(l.debitCents || l.creditCents),
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: {
        PostingType: l.debitCents ? "Debit" : "Credit",
        AccountRef: { value: l.account, name: CHART[l.account].name },
      },
    })),
  }));
  return JSON.stringify({ JournalEntry: entries }, null, 2) + "\n";
}

// The flow matrix: for the two accounts the gallery controls, where may money
// go? Each cell is decided by submitting a real entry to the journal's own
// rules (rejections()), not by a second copy of them.

export const FLOW_FROM: AccountKind[] = ["operating", "trust"];
export const FLOW_TO: AccountKind[] = [
  "operating",
  "trust",
  "artist",
  "buyer",
  "creditors",
];

const CODES: JournalCode[] = [
  "RECEIPT_SPLIT",
  "TRUST_TO_ARTIST",
  "TRUST_TO_BUYER",
  "OPERATING_TO_BUYER",
  "OPERATING_TO_CREDITORS",
  "TRANSFER",
];

export interface FlowCell {
  from: AccountKind;
  to: AccountKind;
  allowed: boolean;
  /** Codes that may make this move, or the rule that refuses it. */
  detail: string;
}

export function flowMatrix(): FlowCell[] {
  const g = "gal_x";
  const account = (k: AccountKind, party: string) =>
    k === "operating" || k === "creditors" || k === "equity"
      ? `${k}:${g}`
      : `${k}:${g}:${party}`;
  const cells: FlowCell[] = [];
  for (const from of FLOW_FROM) {
    for (const to of FLOW_TO) {
      if (from === to) continue;
      const src = account(from, "a1");
      // Fund the source so the floor rule doesn't decide the cell.
      const funded = [
        {
          id: "seed",
          at: "",
          code: "OPENING" as const,
          postings: [
            { account: `equity:${g}`, cents: -100 },
            { account: src, cents: 100 },
          ],
          ref: null,
        },
      ];
      const ok: JournalCode[] = [];
      let why = "";
      for (const code of CODES) {
        const entry = {
          id: "probe",
          at: "",
          code,
          postings: [
            { account: src, cents: -1 },
            { account: account(to, "a1"), cents: 1 },
          ],
          ref: null,
        };
        const trustRelease =
          code === "TRUST_TO_ARTIST" || code === "TRUST_TO_BUYER";
        // In the probe, sale "a1" belongs to artist "a1".
        const r = rejections(funded, entry, {
          trustRelease,
          saleArtist: (id) => id,
        });
        if (r.length === 0) ok.push(code);
        else if (!why) why = r[0];
      }
      cells.push({
        from,
        to,
        allowed: ok.length > 0,
        detail: ok.length > 0 ? ok.join(", ") : why,
      });
    }
  }
  return cells;
}

export function accountLabel(k: AccountKind): string {
  return ACCOUNT_RULES[k].label;
}

export function describeTieOut(t: TieOut): string {
  return t.ok
    ? `Trust covered ${(t.coverageBps / 100).toFixed(2)}%: held in trust ${formatCents(t.restrictedCashCents)} = due to artists in the ledger ${formatCents(t.dueToArtistsCents)}`
    : `Trust does not tie out: held in trust ${formatCents(t.restrictedCashCents)}, due to artists in the ledger ${formatCents(t.dueToArtistsCents)} (${(t.coverageBps / 100).toFixed(2)}% covered)`;
}
