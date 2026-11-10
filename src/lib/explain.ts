// "Where does this number come from?" Every balance on screen, opened into
// the journal entries that sum to it, each labelled from the record it posts
// (the payment and its bank id, the payout, the refund). A test asserts every
// drawer sums to the figure it explains, at every step of the demo.
import type { Cents, Id, JournalEntry, Snapshot } from "@/types";
import { formatCents, methodLabel } from "@/lib/money";

export type Metric =
  | "operating"
  | "trust"
  | "paidToArtists"
  | "refunded"
  | "creditors"
  | "received";

export interface ExplainRow {
  label: string;
  cents: Cents;
  at: string;
  /** The record behind the row: a payment, payout, refund, sale or journal entry. */
  ref: Id;
}

function label(s: Snapshot, e: JournalEntry): string {
  const payment = s.payments.find((p) => p.id === e.ref);
  const sale = s.sales.find((x) => x.id === (payment?.saleId ?? e.ref));
  const work = s.artworks.find((w) => w.id === sale?.artworkId)?.title;
  const payout = s.payouts.find((p) => p.id === e.ref);
  const artist = (id?: Id) => s.artists.find((a) => a.id === id)?.name ?? "";
  switch (e.code) {
    case "OPENING":
      return "Opening balance";
    case "RECEIPT_SPLIT":
      return payment
        ? `${methodLabel(payment.method)} in, ${work ?? "sale"} (${formatCents(payment.amountCents)}, bank id ${payment.rampTransactionId ?? "none"})`
        : "Buyer payment";
    case "TRUST_TO_ARTIST":
      return `Paid to ${artist(payout?.artistId ?? sale?.artistId)}${work ? `, ${work}` : ""}`;
    case "TRUST_TO_BUYER":
      return `Refunded to ${sale?.buyerName ?? "the buyer"} from trust`;
    case "OPERATING_TO_BUYER":
      return `Refunded to ${sale?.buyerName ?? "the buyer"} from operating`;
    case "OPERATING_TO_CREDITORS":
      return "Turned over to the administrator";
    default:
      return e.code;
  }
}

/** The rows that sum to one balance, in journal order. */
export function explain(
  s: Snapshot,
  galleryId: Id,
  metric: Metric,
): ExplainRow[] {
  const rows: ExplainRow[] = [];
  let journal = s.journal;
  let m: Metric = metric;
  if (metric === "creditors") {
    // What the creditors took is the operating balance at the moment of
    // failure: every entry before the transfer, cut by position (the
    // transfer and the insolvency payouts share a timestamp).
    const i = journal.findIndex(
      (e) =>
        e.code === "OPERATING_TO_CREDITORS" &&
        e.postings.some((p) => p.account === `operating:${galleryId}`),
    );
    if (i < 0) return [];
    journal = journal.slice(0, i);
    m = "operating";
  }
  const matches = (account: string, cents: Cents) => {
    const [kind, g] = account.split(":");
    if (g !== galleryId) return false;
    switch (m) {
      case "operating":
        return kind === "operating";
      case "trust":
        return kind === "trust";
      case "paidToArtists":
        return kind === "artist";
      case "refunded":
        return kind === "buyer" && cents > 0;
      case "received":
        return kind === "buyer" && cents < 0;
      default:
        return false;
    }
  };
  for (const e of journal) {
    const cents = e.postings
      .filter((p) => matches(p.account, p.cents))
      .reduce((t, p) => t + p.cents, 0);
    if (cents === 0) continue;
    rows.push({
      label: label(s, e),
      cents: m === "received" ? -cents : cents,
      at: e.at,
      ref: e.ref ?? e.id,
    });
  }
  return rows;
}

export const METRIC_LABEL: Record<Metric, string> = {
  operating: "Operating cash",
  trust: "Held in artist trust",
  paidToArtists: "Paid to artists",
  refunded: "Refunded to buyers",
  creditors: "Taken by creditors",
  received: "Received from buyers",
};
