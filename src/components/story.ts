import type { Snapshot } from "@/types";
import { formatCents } from "@/lib/money";
import { paidSoFar } from "@/lib/escrow/engine";

// The scripted story: Ines Duarte consigns "Orchard in Rain", a collector buys
// it in three payments, and every dollar is routed as it lands.
export const ARTIST = "art_ines";
export const AGREEMENT = "agr_ines";
export const WORK = "wrk_orchard";
const BUYER = "Marisol Ybarra";
const METHODS = ["wire", "ach", "wire"] as const;

export type Step = {
  index: number;
  title: string;
  caption: string;
  next?: { label: string; path: string; body: unknown };
  canCancel?: boolean;
  /** The gallery can be made to fail (key B) once money is in trust. */
  canFail?: boolean;
  /** The gallery tries to spend the story sale's trust money (key G). */
  attempt?: { path: string; body: unknown };
  /** Jump the demo clock past Ines's payout deadline (key T). */
  advance?: { label: string; path: string; body: unknown };
  /** The bank feed redelivers the latest transaction (key D). */
  redeliver?: { path: string; body: unknown };
};

/** Days the demo clock jumps: one past Ines's 60-day payout window. */
export const JUMP_DAYS = 61;

/** Whole days the demo clock is ahead of the wall clock. */
export function demoDays(s: Snapshot): number {
  return Math.round((s.clockOffsetMs ?? 0) / 86_400_000);
}

export const GALLERY = "gal_lowline";

export function stepFor(s: Snapshot): Step {
  const agreement = s.agreements.find((a) => a.id === AGREEMENT);
  const sale = s.sales.filter((x) => x.artworkId === WORK).at(-1);
  const payments = sale ? s.payments.filter((p) => p.saleId === sale.id) : [];
  const gallery = s.galleries.find((g) => g.id === GALLERY);

  if (gallery?.status === "insolvent") {
    const claimed = formatCents(gallery.claimedByCreditorsCents ?? 0);
    // Payouts are recorded a moment after the insolvency itself.
    const toInes = s.payouts
      .filter(
        (p) =>
          p.artistId === ARTIST &&
          !!gallery.insolventAt &&
          p.paidAt >= gallery.insolventAt,
      )
      .reduce((t, p) => t + p.amountCents, 0);
    return {
      index: 7,
      title: "The gallery went under. Ines still got paid",
      caption: `Lowline Gallery is insolvent. Creditors took the ${claimed} in operating cash, the same way Stephen Friedman's creditors did. But the ${formatCents(toInes)} held for Ines was never the gallery's: Rescrow paid it out of trust straight to her. Same failure. This time the artist gets paid.`,
    };
  }

  if (!agreement?.terms) {
    return {
      index: 0,
      title: "A new consignment",
      caption:
        "Ines Duarte consigns Orchard in Rain to Lowline Gallery. Rescrow won't let it sell until the agent has read her agreement and the split is on file.",
      next: {
        label: "Read the agreement",
        path: "/api/agent/read",
        body: { agreementId: AGREEMENT, mode: "live" },
      },
    };
  }
  if (!sale || sale.status === "cancelled") {
    if (sale?.status === "cancelled") {
      const r = s.refunds.find((x) => x.saleId === sale.id);
      const covered = r?.coveredByGalleryCents ?? 0;
      return {
        index: 6,
        title: "Buyer cancelled",
        caption:
          covered > 0
            ? `The buyer walked away and got every cent back. ${r!.fromTrustCents > 0 ? `${formatCents(r!.fromTrustCents)} still held for Ines came straight out of trust. ` : ""}Ines keeps the ${formatCents(covered)} she was already paid on her deadline; the gallery refunds that part from its own operating cash, not from trust.`
            : "The buyer walked away. Ines's share is refunded to them straight from the trust account. The gallery never had it, so it can't have spent it.",
      };
    }
    const failed = agreement.terms.checks?.filter((c) => !c.ok) ?? [];
    if (failed.length > 0) {
      return {
        index: 1,
        title: "Agent read it, a person has to confirm",
        caption: `The agent couldn't back everything with a quote (${failed.map((c) => c.label.toLowerCase()).join("; ")}), so Rescrow won't let money move on these terms. A person confirms by using the reviewed terms on file.`,
        next: {
          label: "Use the reviewed terms on file",
          path: "/api/agent/read",
          body: { agreementId: AGREEMENT, mode: "saved" },
        },
      };
    }
    return {
      index: 1,
      title: "Agreement read",
      caption:
        agreement.termsSource === "model"
          ? `The agent pulled ${agreement.terms.artistShareBps / 100}% to the artist and a ${agreement.terms.payoutDays} day payout window, and quoted the exact clauses it relied on. That split is now fixed for every sale of her work.`
          : `Using the reviewed terms on file: ${agreement.terms.artistShareBps / 100}% to the artist, paid within ${agreement.terms.payoutDays} days. The clauses they come from are highlighted. That split is now fixed for every sale of her work.`,
      next: {
        label: "Collector buys it",
        path: "/api/demo/sale",
        body: { artworkId: WORK, buyerName: BUYER, installments: 3 },
      },
    };
  }
  // Shares of this sale already paid to Ines on their agreement deadline.
  const onDeadline = s.payouts
    .filter(
      (p) =>
        p.artistId === ARTIST &&
        p.reason === "deadline" &&
        s.holds.some((h) => p.holdIds.includes(h.id) && h.saleId === sale.id),
    )
    .reduce((t, p) => t + p.amountCents, 0);

  if (sale.status === "paid") {
    return {
      redeliver: { path: "/api/demo/redeliver", body: { galleryId: GALLERY } },
      index: 5,
      title: "Paid in full, artist paid today",
      caption:
        onDeadline > 0
          ? `The last payment landed and Rescrow released the rest of the trust the same day. Ines had already been paid ${formatCents(onDeadline)} on her deadline while the buyer was still paying; now she has all of it, with a statement for each.`
          : `The last payment landed and Rescrow released the trust the same day. Ines has her money and a statement. Her agreement allowed ${agreement.terms.payoutDays} days; she was paid the day the buyer finished paying.`,
    };
  }
  const n = payments.length;
  const due = formatCents(
    Math.ceil(
      (sale.priceCents - paidSoFar(s, sale.id)) / (sale.installments - n),
    ),
  );
  const captions = [
    `${BUYER} agreed to ${formatCents(sale.priceCents)} in three payments. Nothing has moved yet.`,
    "The first wire arrived. Half went straight to the artist trust account, the other half to operating. The gallery can't spend Ines's half.",
    "Second payment, by ACH. Same split, same second it lands. Ines can see every dollar held for her on her phone.",
  ];
  const days = demoDays(s);
  const theo = s.payouts.some(
    (p) => p.artistId === "art_theo" && p.reason === "deadline",
  );
  const late = days > 0 && onDeadline > 0;
  return {
    index: 2 + n,
    title: late
      ? `Day +${days}: Ines paid on her deadline`
      : n === 0
        ? "Sale agreed"
        : `Payment ${n} of 3 received`,
    caption: late
      ? `${days} days later the buyer still owes ${3 - n} of 3 payments. Ines's agreement says each share is due within ${agreement.terms.payoutDays} days of the payment that funded it, so Rescrow paid her ${formatCents(onDeadline)} out of trust on the deadline anyway.${theo ? " Theo's 14-day share on another sale went out on its own deadline too." : ""} The rest stays locked until it is due.`
      : (captions[n] ?? ""),
    next: {
      label:
        n === 2
          ? `Final ${due} wire arrives`
          : `${METHODS[n] === "ach" ? "ACH" : "Wire"} for ${due} arrives`,
      path: "/api/demo/payment",
      body: {
        saleId: sale.id,
        method: METHODS[n] ?? "wire",
        // The bank's id for this transaction: pressing → twice can't book it twice.
        rampTransactionId: `rtx_${sale.id}_${n + 1}`,
      },
    },
    canCancel: n > 0,
    redeliver:
      n > 0
        ? { path: "/api/demo/redeliver", body: { galleryId: GALLERY } }
        : undefined,
    // After a clock jump some of Ines's trust is already paid out, so the
    // insolvency take (narrated as $8,000 to Ines) is only offered at day 0.
    canFail: n > 0 && days === 0,
    advance:
      n > 0 && days === 0
        ? {
            label: `${JUMP_DAYS} days pass`,
            path: "/api/demo/advance",
            body: { days: JUMP_DAYS },
          }
        : undefined,
    attempt:
      n > 0 &&
      s.holds.some((h) => h.saleId === sale.id && h.status === "locked")
        ? {
            path: "/api/demo/attempt",
            body: { saleId: sale.id, kind: "rent" },
          }
        : undefined,
  };
}
