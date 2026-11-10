import type { Cents, PaymentMethod } from "@/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCents(cents: Cents): string {
  return usd.format(cents / 100);
}

/** Artist share of an amount, rounded to the nearest cent. */
export function shareOf(amountCents: Cents, bps: number): Cents {
  return Math.round((amountCents * bps) / 10_000);
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  wire: "Wire",
  ach: "ACH",
  card: "Card",
};

export function methodLabel(method: PaymentMethod): string {
  return METHOD_LABEL[method];
}
