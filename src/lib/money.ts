import type { Cents } from "@/types";

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
