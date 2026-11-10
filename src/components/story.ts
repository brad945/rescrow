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
};

export function stepFor(s: Snapshot): Step {
  const agreement = s.agreements.find((a) => a.id === AGREEMENT);
  const sale = s.sales.filter((x) => x.artworkId === WORK).at(-1);
  const payments = sale ? s.payments.filter((p) => p.saleId === sale.id) : [];

  if (!agreement?.terms) {
    return {
      index: 0,
      title: "A new consignment",
      caption:
        "Ines Duarte consigns Orchard in Rain to Lowline Gallery. Rescrow won't let it sell until the agent has read her agreement and the split is on file.",
      next: {
        label: "Read the agreement",
        path: "/api/agent/read",
        body: { agreementId: AGREEMENT },
      },
    };
  }
  if (!sale || sale.status === "cancelled") {
    if (sale?.status === "cancelled") {
      return {
        index: 6,
        title: "Buyer cancelled",
        caption:
          "The buyer walked away. Ines's share is refunded to them straight from the trust account. The gallery never had it, so it can't have spent it.",
      };
    }
    return {
      index: 1,
      title: "Agreement read",
      caption: `The agent pulled ${agreement.terms.artistShareBps / 100}% to the artist and a ${agreement.terms.payoutDays} day payout window, and quoted the exact clauses it relied on. That split is now fixed for every sale of her work.`,
      next: {
        label: "Collector buys it",
        path: "/api/demo/sale",
        body: { artworkId: WORK, buyerName: BUYER, installments: 3 },
      },
    };
  }
  if (sale.status === "paid") {
    return {
      index: 5,
      title: "Paid in full, artist paid today",
      caption: `The last payment landed and Rescrow released the trust the same day. Ines has her money and a statement. Her agreement allowed ${agreement.terms.payoutDays} days; she was paid the day the buyer finished paying.`,
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
  return {
    index: 2 + n,
    title: n === 0 ? "Sale agreed" : `Payment ${n} of 3 received`,
    caption: captions[n] ?? "",
    next: {
      label:
        n === 2
          ? `Final ${due} wire arrives`
          : `${METHODS[n] === "ach" ? "ACH" : "Wire"} for ${due} arrives`,
      path: "/api/demo/payment",
      body: { saleId: sale.id, method: METHODS[n] ?? "wire" },
    },
    canCancel: n > 0,
  };
}
