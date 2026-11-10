// A bank feed, shaped like polling Ramp's transactions list.
//
// Ramp's banking API is read-only and has no deposit webhook, so a real
// integration polls with a cursor. Overlapping windows and pages retried after
// a timeout return transactions already seen, and pages can come back out of
// order. This module is the ingest side of that: it matches each incoming
// transaction to a sale by its memo and books it through receivePayment, which
// is idempotent on the transaction id. FakeRampFeed replays a scripted list of
// pages for tests; nothing in the app polls a real network.
import type { Cents, Id, PaymentMethod, Snapshot } from "@/types";
import {
  EscrowError,
  IdempotencyConflict,
  receivePayment,
  type Clock,
} from "@/lib/escrow/engine";

export interface FeedTransaction {
  id: string;
  amountCents: Cents;
  method: PaymentMethod;
  /** The buyer is asked to put `RSC-<saleId>` in the memo. */
  memo: string;
}

export interface FeedPage {
  transactions: FeedTransaction[];
  next: string | null;
}

export interface BankFeed {
  list(args: { cursor: string | null }): FeedPage;
}

/** Replays scripted pages. Pages may repeat or arrive out of order on purpose. */
export class FakeRampFeed implements BankFeed {
  private calls = 0;
  constructor(private readonly pages: FeedPage[]) {}
  list(): FeedPage {
    const page = this.pages[this.calls] ?? { transactions: [], next: null };
    this.calls += 1;
    return page;
  }
}

export function saleIdFromMemo(memo: string): Id | null {
  const m = memo.match(/\bRSC-(\S+)/);
  return m ? m[1] : null;
}

export interface IngestResult {
  snapshot: Snapshot;
  booked: string[];
  duplicates: string[];
  unmatched: string[];
  /** Matched a sale but the engine refused it (sale already paid, gallery insolvent...). */
  refused: { id: string; reason: string }[];
}

/**
 * Books every transaction in a page once, however many times it is delivered.
 * One refused transaction is set aside with its reason and the rest of the
 * page still books, so a single bad deposit can't stall the feed. The one
 * exception is a conflicting redelivery (same id, different details), which
 * throws: that means the bank and the books disagree about history.
 */
export function ingest(
  input: Snapshot,
  txns: FeedTransaction[],
  clock: Clock,
): IngestResult {
  let s = input;
  const out: IngestResult = {
    snapshot: s,
    booked: [],
    duplicates: [],
    unmatched: [],
    refused: [],
  };
  for (const t of txns) {
    const saleId = saleIdFromMemo(t.memo);
    if (!saleId || !s.sales.some((x) => x.id === saleId)) {
      out.unmatched.push(t.id);
      continue;
    }
    const seen = s.payments.some((p) => p.rampTransactionId === t.id);
    try {
      s = receivePayment(
        s,
        {
          saleId,
          amountCents: t.amountCents,
          method: t.method,
          rampTransactionId: t.id,
        },
        clock,
      ).snapshot;
    } catch (err) {
      if (err instanceof IdempotencyConflict) throw err;
      if (!(err instanceof EscrowError)) throw err;
      out.refused.push({ id: t.id, reason: err.message });
      continue;
    }
    (seen ? out.duplicates : out.booked).push(t.id);
  }
  out.snapshot = s;
  return out;
}

/** Drains a feed page by page, ingesting each. Throws only on a conflicting redelivery. */
export function drain(
  input: Snapshot,
  feed: BankFeed,
  clock: Clock,
  maxPages = 50,
): IngestResult {
  let cursor: string | null = null;
  const total: IngestResult = {
    snapshot: input,
    booked: [],
    duplicates: [],
    unmatched: [],
    refused: [],
  };
  for (let i = 0; i < maxPages; i++) {
    const page = feed.list({ cursor });
    const r = ingest(total.snapshot, page.transactions, clock);
    total.snapshot = r.snapshot;
    total.booked.push(...r.booked);
    total.duplicates.push(...r.duplicates);
    total.unmatched.push(...r.unmatched);
    total.refused.push(...r.refused);
    if (!page.next) return total;
    cursor = page.next;
  }
  throw new EscrowError(`Feed still had pages after ${maxPages}`);
}
