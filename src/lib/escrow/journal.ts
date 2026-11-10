// Double-entry journal kept beside the engine's records.
//
// Every money movement is also written here as one entry whose postings sum to
// zero. The engine's records (balances, holds, payouts) stay the source the
// screens read; reconcile() folds this journal and checks that it agrees with
// them to the cent, so there are two independent records of every move.
//
// The rules about where money may go live on the accounts, as data
// (ACCOUNT_RULES), and are enforced when an entry is posted, before anything
// changes:
// - nothing may go below zero in operating or trust;
// - trust may only be paid to its own artist, or back to a buyer of that
//   gallery, and only by the two trust release codes;
// - post() never debits trust at all. Trust releases go through
//   postTrustRelease(), which only engine.ts's releaseTrust() calls (an
//   architecture test pins that).
import type {
  AccountId,
  Cents,
  Id,
  JournalCode,
  JournalEntry,
  Posting,
  Snapshot,
  Timestamp,
} from "@/types";
import { formatCents } from "@/lib/money";
import { LedgerRejected } from "./errors";

export type AccountKind =
  "equity" | "operating" | "trust" | "artist" | "buyer" | "creditors";

export const acct = {
  equity: (g: Id): AccountId => `equity:${g}`,
  operating: (g: Id): AccountId => `operating:${g}`,
  trust: (g: Id, artist: Id): AccountId => `trust:${g}:${artist}`,
  artist: (g: Id, artist: Id): AccountId => `artist:${g}:${artist}`,
  buyer: (g: Id, sale: Id): AccountId => `buyer:${g}:${sale}`,
  creditors: (g: Id): AccountId => `creditors:${g}`,
};

export function parseAccount(a: AccountId): {
  kind: AccountKind;
  gallery: Id;
  party: Id | null;
} {
  const [kind, gallery, party] = a.split(":");
  if (!(kind in ACCOUNT_RULES) || !gallery) {
    throw new LedgerRejected(`Unknown account ${a}`);
  }
  return { kind: kind as AccountKind, gallery, party: party ?? null };
}

const TRUST_CODES: JournalCode[] = ["TRUST_TO_ARTIST", "TRUST_TO_BUYER"];

export interface AccountRule {
  /** What the account is, in plain words. */
  label: string;
  /** The balance may never go below this. Undefined: no floor (outside parties). */
  minBalance?: Cents;
  /** Codes allowed to take money out of the account. Undefined: any code. */
  debitCodes?: JournalCode[];
  /** Account kinds money taken out may go to. Undefined: any. */
  debitTo?: AccountKind[];
}

/** The rules each kind of account carries. Enforced by post() and postTrustRelease(). */
export const ACCOUNT_RULES: Record<AccountKind, AccountRule> = {
  equity: { label: "Opening balances" },
  operating: {
    label: "Gallery operating cash",
    minBalance: 0,
    debitCodes: ["OPERATING_TO_BUYER", "OPERATING_TO_CREDITORS"],
    debitTo: ["buyer", "creditors"],
  },
  trust: {
    label: "Artist trust",
    minBalance: 0,
    debitCodes: TRUST_CODES,
    debitTo: ["artist", "buyer"],
  },
  artist: { label: "Paid to the artist" },
  buyer: { label: "Buyer" },
  creditors: { label: "Creditors" },
};

const KNOWN_CODES: JournalCode[] = [
  "OPENING",
  "RECEIPT_SPLIT",
  "TRUST_TO_ARTIST",
  "TRUST_TO_BUYER",
  "OPERATING_TO_BUYER",
  "OPERATING_TO_CREDITORS",
  "TRANSFER",
];

/** Folds the journal into a balance per account. */
export function balancesOf(journal: JournalEntry[]): Map<AccountId, Cents> {
  const out = new Map<AccountId, Cents>();
  for (const e of journal) {
    for (const p of e.postings) {
      out.set(p.account, (out.get(p.account) ?? 0) + p.cents);
    }
  }
  return out;
}

/**
 * Builds an entry, dropping zero postings. Returns null when nothing would
 * move, so a hook with a zero total posts nothing instead of being rejected.
 */
export function entry(
  id: Id,
  at: Timestamp,
  code: JournalCode,
  postings: Posting[],
  ref: Id | null,
): JournalEntry | null {
  const nonZero = postings.filter((p) => p.cents !== 0);
  if (nonZero.length === 0) return null;
  return { id, at, code, postings: nonZero, ref };
}

/** Every reason this entry may not post, in order; empty if it may. */
export function rejections(
  journal: JournalEntry[],
  e: JournalEntry,
  {
    trustRelease,
    saleArtist,
  }: {
    trustRelease: boolean;
    /** Whose sale a buyer account belongs to, for trust refunds. */
    saleArtist?: (saleId: Id) => Id | undefined;
  },
): string[] {
  const out: string[] = [];
  if (!KNOWN_CODES.includes(e.code)) out.push(`Unknown code ${e.code}`);
  if (e.postings.length < 2) out.push("An entry needs at least two postings");
  let sum = 0;
  for (const p of e.postings) {
    if (!Number.isInteger(p.cents) || p.cents === 0) {
      out.push(
        `${p.account}: ${p.cents} is not a whole, non-zero number of cents`,
      );
    }
    sum += p.cents;
  }
  if (sum !== 0) out.push(`Postings sum to ${sum}, not zero`);

  let parsed: {
    p: Posting;
    kind: AccountKind;
    gallery: Id;
    party: Id | null;
  }[];
  try {
    parsed = e.postings.map((p) => ({ p, ...parseAccount(p.account) }));
  } catch (err) {
    return [...out, (err as Error).message];
  }
  const credits = parsed.filter((x) => x.p.cents > 0);

  for (const d of parsed.filter((x) => x.p.cents < 0)) {
    const rule = ACCOUNT_RULES[d.kind];
    if (d.kind === "trust" && !trustRelease) {
      out.push(
        `${d.p.account} is held in trust for ${d.party}. Trust may only pay the artist or refund the buyer, never ${credits.map((c) => c.p.account).join(", ") || "anything"} (${e.code})`,
      );
      continue;
    }
    if (rule.debitCodes && !rule.debitCodes.includes(e.code)) {
      out.push(
        `${d.p.account} may only be debited by ${rule.debitCodes.join(" or ")}, not ${e.code}`,
      );
    }
    for (const c of credits) {
      if (rule.debitTo && !rule.debitTo.includes(c.kind)) {
        out.push(`${rule.label} can't pay ${c.p.account}`);
      }
      if (c.gallery !== d.gallery) {
        out.push(`${d.p.account} can't pay another gallery's ${c.p.account}`);
      }
    }
  }
  // Each trust code has exactly one kind of destination, and money only goes
  // back to its own artist: per artist, what leaves that artist's trust equals
  // what reaches that artist (TRUST_TO_ARTIST) or the buyers of that artist's
  // own sales (TRUST_TO_BUYER). A buyer account is mapped to its artist with
  // saleArtist; without that map a trust refund is refused.
  if (e.code === "TRUST_TO_ARTIST" || e.code === "TRUST_TO_BUYER") {
    const dest: AccountKind = e.code === "TRUST_TO_ARTIST" ? "artist" : "buyer";
    for (const c of credits) {
      if (c.kind !== dest) {
        out.push(`${e.code} may only pay ${dest} accounts, not ${c.p.account}`);
      }
    }
    const perArtist = new Map<string, Cents>();
    const add = (k: string, cents: Cents) =>
      perArtist.set(k, (perArtist.get(k) ?? 0) + cents);
    for (const x of parsed) {
      if (x.kind === "trust" || x.kind === "artist") {
        add(`${x.gallery}:${x.party}`, x.p.cents);
      } else if (x.kind === "buyer") {
        const artist = x.party ? saleArtist?.(x.party) : undefined;
        if (!artist) {
          out.push(`Can't tell whose sale ${x.p.account} is`);
          continue;
        }
        add(`${x.gallery}:${artist}`, x.p.cents);
      }
    }
    for (const [k, rest] of perArtist) {
      if (rest !== 0) {
        out.push(
          `Trust for ${k} and what it pays differ by ${rest} cents: trust only pays its own artist, or the buyers of that artist's sales`,
        );
      }
    }
  }
  if (trustRelease) {
    if (!TRUST_CODES.includes(e.code)) {
      out.push(
        `A trust release must be ${TRUST_CODES.join(" or ")}, not ${e.code}`,
      );
    }
    if (parsed.some((x) => x.p.cents < 0 && x.kind !== "trust")) {
      out.push("A trust release may only take money out of trust");
    }
  }

  // Floors, checked against the balance each account would have after posting.
  const balances = balancesOf(journal);
  const net = new Map<AccountId, Cents>();
  for (const p of e.postings)
    net.set(p.account, (net.get(p.account) ?? 0) + p.cents);
  for (const [account, change] of net) {
    const min = ACCOUNT_RULES[parseAccount(account).kind].minBalance;
    const after = (balances.get(account) ?? 0) + change;
    if (min !== undefined && after < min) {
      out.push(
        `${account} would go to ${formatCents(after)}, below its floor of ${formatCents(min)}`,
      );
    }
  }
  return out;
}

function apply(
  s: Snapshot,
  e: JournalEntry | null,
  trustRelease: boolean,
): void {
  if (!e) return;
  const why = rejections(s.journal, e, {
    trustRelease,
    saleArtist: (id) => s.sales.find((x) => x.id === id)?.artistId,
  });
  if (why.length > 0) {
    throw new LedgerRejected(`Ledger refused ${e.code}: ${why.join("; ")}`);
  }
  s.journal.push(e);
}

/** Posts an entry that doesn't take money out of trust. Throws LedgerRejected before changing anything. */
export function post(s: Snapshot, e: JournalEntry | null): void {
  apply(s, e, false);
}

/**
 * The only way to post a debit to a trust account: TRUST_TO_ARTIST or
 * TRUST_TO_BUYER, out of trust only, to that artist or a buyer. Only
 * releaseTrust() in engine.ts calls this.
 */
export function postTrustRelease(s: Snapshot, e: JournalEntry | null): void {
  apply(s, e, true);
}

/**
 * The journal for a seeded snapshot: opening balances, then the seed's own
 * history (payments split, payouts made) replayed in time order through the
 * same rules as live postings.
 */
export function openingJournal(
  s: Omit<Snapshot, "journal" | "refunds">,
): JournalEntry[] {
  const out = { ...s, journal: [], refunds: [] } as Snapshot;
  let n = 0;
  const id = () => `je_seed_${++n}`;

  for (const g of s.galleries) {
    if (g.openingBalanceCents === undefined) continue;
    post(
      out,
      entry(
        id(),
        s.activity.at(-1)?.at ?? "",
        "OPENING",
        [
          { account: acct.equity(g.id), cents: -g.openingBalanceCents },
          { account: acct.operating(g.id), cents: g.openingBalanceCents },
        ],
        g.id,
      ),
    );
  }

  type Ev = { at: Timestamp; order: number; run: () => void };
  const events: Ev[] = [];
  for (const p of s.payments) {
    const hold = s.holds.find((h) => h.paymentId === p.id);
    const share = hold?.amountCents ?? 0;
    events.push({
      at: p.receivedAt,
      order: 0,
      run: () =>
        post(
          out,
          entry(
            id(),
            p.receivedAt,
            "RECEIPT_SPLIT",
            [
              {
                account: acct.buyer(p.galleryId, p.saleId),
                cents: -p.amountCents,
              },
              {
                account: acct.operating(p.galleryId),
                cents: p.amountCents - share,
              },
              {
                account: acct.trust(p.galleryId, hold?.artistId ?? ""),
                cents: share,
              },
            ],
            p.id,
          ),
        ),
    });
  }
  for (const po of s.payouts) {
    events.push({
      at: po.paidAt,
      order: 1,
      run: () =>
        postTrustRelease(
          out,
          entry(
            id(),
            po.paidAt,
            "TRUST_TO_ARTIST",
            [
              {
                account: acct.trust(po.galleryId, po.artistId),
                cents: -po.amountCents,
              },
              {
                account: acct.artist(po.galleryId, po.artistId),
                cents: po.amountCents,
              },
            ],
            po.id,
          ),
        ),
    });
  }
  events
    .sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order)
    .forEach((e) => e.run());
  return out.journal;
}
