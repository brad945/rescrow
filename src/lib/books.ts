// The gallery's books, for its accountant.
//
// A read-only view built from the journal: every journal entry becomes a
// balanced general-ledger (GL) entry on a small chart of accounts, in which
// money held for artists is restricted cash owed to them (a liability), never
// revenue. Nothing here posts or changes state.
//
// One simplification, stated on screen: commission is booked as revenue when
// each payment lands and reversed if the sale is cancelled. Holding it as a
// buyer deposit until the sale completes would be stricter.
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
        const commission = total("operating");
        add("1010", "debit", commission, "Buyer payment, gallery part");
        add("4010", "credit", commission, "Commission on buyer payment");
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
          "4010",
          "debit",
          out - covered,
          "Commission reversed, sale cancelled",
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
  restrictedCashCents: Cents;
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
 * The balance-sheet identity an accountant can check: restricted trust cash
 * equals what is owed to artists, in total and artist by artist, and each
 * artist's sub-ledger equals their locked holds in the engine's records.
 */
export function trustTieOut(s: Snapshot, galleryId: Id): TieOut {
  const lines = glLines(s, galleryId);
  const bal = (code: string, artistId?: Id) =>
    lines
      .filter(
        (l) =>
          l.account === code &&
          (artistId === undefined || l.artistId === artistId),
      )
      .reduce(
        (t, l) =>
          t +
          (CHART[code].normal === "debit"
            ? l.debitCents - l.creditCents
            : l.creditCents - l.debitCents),
        0,
      );
  const restrictedCashCents = bal("1020");
  const dueToArtistsCents = bal("2010");
  const artists = new Set([
    ...lines.filter((l) => l.artistId).map((l) => l.artistId!),
    ...s.holds.filter((h) => h.galleryId === galleryId).map((h) => h.artistId),
  ]);
  const perArtist = [...artists].sort().map((artistId) => {
    const owedCents = bal("2010", artistId);
    const lockedCents = s.holds
      .filter(
        (h) =>
          h.galleryId === galleryId &&
          h.artistId === artistId &&
          h.status === "locked",
      )
      .reduce((t, h) => t + h.amountCents, 0);
    return { artistId, owedCents, lockedCents, ok: owedCents === lockedCents };
  });
  const ok =
    restrictedCashCents === dueToArtistsCents && perArtist.every((a) => a.ok);
  const coverageBps =
    dueToArtistsCents === 0
      ? 10_000
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
        const r = rejections(funded, entry, { trustRelease });
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
    ? `Trust covered ${(t.coverageBps / 100).toFixed(2)}%: restricted cash ${formatCents(t.restrictedCashCents)} = due to artists ${formatCents(t.dueToArtistsCents)}`
    : `Trust does not tie out: restricted cash ${formatCents(t.restrictedCashCents)}, due to artists ${formatCents(t.dueToArtistsCents)}`;
}
