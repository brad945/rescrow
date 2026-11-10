// What an artist can see about their own money, from the records only.
//
// Every buyer payment on the artist's sales, with the bank's transaction id
// (the same id idempotent ingest keys on, so the artist can match it to what
// the gallery says), the share locked from it, and when and why that share
// was paid. Wording comes from the payout's recorded reason and recorded
// dates; nothing here guesses "late" or "on time".
import type { Cents, HoldStatus, Id, PaymentMethod, Snapshot } from "@/types";

export interface ArtistPaymentRow {
  saleId: Id;
  holdId: Id;
  workTitle: string;
  /** 1-based position of this payment on its sale, and the sale's plan. */
  installment: number;
  installments: number;
  receivedAt: string;
  method: PaymentMethod;
  amountCents: Cents;
  rampTransactionId: string | null;
  shareCents: Cents;
  status: HoldStatus;
  dueBy: string | null;
  paidAt: string | null;
  how: "completion" | "deadline" | "insolvency" | null;
  /** Whole calendar days (UTC) from payout to deadline, for completion payouts. */
  daysBeforeDeadline: number | null;
  /** One line for the artist, built from the recorded facts. */
  summary: string;
}

const DAY = 86_400_000;

/** Whole UTC calendar days from a to b (a share released seconds after it was locked on a 60-day window reads 60). */
export function calendarDays(a: string, b: string): number {
  const day = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10)) / DAY);
  return day(b) - day(a);
}

function dateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function artistPayments(s: Snapshot, artistId: Id): ArtistPaymentRow[] {
  const rows: ArtistPaymentRow[] = [];
  for (const sale of s.sales.filter((x) => x.artistId === artistId)) {
    const work = s.artworks.find((w) => w.id === sale.artworkId);
    const payments = s.payments.filter((p) => p.saleId === sale.id);
    payments.forEach((p, i) => {
      const hold = s.holds.find((h) => h.paymentId === p.id);
      if (!hold) return;
      const payout =
        hold.status === "paid"
          ? s.payouts.find((po) => po.holdIds.includes(hold.id))
          : undefined;
      const how =
        hold.status !== "paid"
          ? null
          : payout?.reason === "deadline"
            ? "deadline"
            : payout?.reason === "insolvency"
              ? "insolvency"
              : "completion";
      const paidAt = payout?.paidAt ?? null;
      const dueBy = hold.dueBy ?? null;
      const daysBeforeDeadline =
        how === "completion" && paidAt && dueBy
          ? calendarDays(paidAt, dueBy)
          : null;

      let summary: string;
      if (hold.status === "locked") {
        summary = dueBy
          ? `Held in trust, due to you by ${dateOnly(dueBy)}`
          : "Held in trust";
      } else if (hold.status === "refunded") {
        summary =
          "Returned to the buyer from trust when the sale was cancelled";
      } else if (how === "deadline") {
        summary = `Paid on its deadline, ${dateOnly(paidAt!)}, while the buyer was still paying`;
      } else if (how === "insolvency") {
        summary =
          "Paid out of trust when the gallery became insolvent, not to its creditors";
      } else if (daysBeforeDeadline === 0) {
        summary = "Paid when the sale completed, on the deadline day";
      } else if (daysBeforeDeadline !== null) {
        summary = `Paid when the sale completed, ${daysBeforeDeadline} day${daysBeforeDeadline === 1 ? "" : "s"} before the deadline`;
      } else {
        summary = "Paid when the sale completed (no deadline on record)";
      }

      rows.push({
        saleId: sale.id,
        holdId: hold.id,
        workTitle: work?.title ?? sale.artworkId,
        installment: i + 1,
        installments: sale.installments,
        receivedAt: p.receivedAt,
        method: p.method,
        amountCents: p.amountCents,
        rampTransactionId: p.rampTransactionId ?? null,
        shareCents: hold.amountCents,
        status: hold.status,
        dueBy,
        paidAt,
        how,
        daysBeforeDeadline,
        summary,
      });
    });
  }
  return rows.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export interface PaymentScorecard {
  completion: number;
  deadline: number;
  insolvency: number;
  held: number;
  returned: number;
  /** e.g. "3 shares paid when the sale completed, all before the deadline". */
  line: string;
}

/** Counts paid shares by the payout's recorded reason, never by comparing timestamps. */
export function paymentScorecard(s: Snapshot, artistId: Id): PaymentScorecard {
  const rows = artistPayments(s, artistId);
  const count = (pred: (r: ArtistPaymentRow) => boolean) =>
    rows.filter(pred).length;
  const completion = count((r) => r.how === "completion");
  const deadline = count((r) => r.how === "deadline");
  const insolvency = count((r) => r.how === "insolvency");
  const held = count((r) => r.status === "locked");
  const returned = count((r) => r.status === "refunded");
  const plural = (n: number) => (n === 1 ? "share" : "shares");
  const parts: string[] = [];
  if (completion > 0) {
    const allEarly = rows
      .filter((r) => r.how === "completion")
      .every((r) => r.daysBeforeDeadline === null || r.daysBeforeDeadline > 0);
    parts.push(
      `${completion} ${plural(completion)} paid when the sale completed${allEarly ? ", all before the deadline" : ""}`,
    );
  }
  if (deadline > 0) {
    parts.push(
      deadline === 1
        ? "1 paid on its deadline"
        : `${deadline} paid on their deadlines`,
    );
  }
  if (insolvency > 0) {
    parts.push(`${insolvency} paid out of trust when the gallery failed`);
  }
  if (held > 0) parts.push(`${held} held in trust`);
  if (returned > 0) parts.push(`${returned} returned to a buyer`);
  return {
    completion,
    deadline,
    insolvency,
    held,
    returned,
    line: parts.length > 0 ? parts.join(" · ") : "No buyer payments yet",
  };
}
