import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/seed";
import { shareOf } from "@/lib/money";
import type { Snapshot } from "@/types";
import {
  cancelSale,
  createSale,
  galleryTotals,
  nextInstallment,
  receivePayment,
  type Clock,
} from "./engine";

// Deterministic pseudo random numbers so failures reproduce.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function testClock(): Clock {
  let n = 0;
  return {
    now: () => "2026-11-10T12:00:00.000Z",
    id: (prefix) => `${prefix}_${++n}`,
  };
}

/** A seed whose first agreement has an arbitrary split and an arbitrary priced work. */
function scenario(priceCents: number, bps: number): Snapshot {
  const s = createSeed();
  s.artworks.find((w) => w.id === "wrk_salt")!.priceCents = priceCents;
  s.agreements.find((a) => a.id === "agr_mara")!.terms!.artistShareBps = bps;
  return s;
}

describe("money invariants across random sales", () => {
  const random = rng(20261110);
  const cases = Array.from({ length: 300 }, () => ({
    price: 100 + Math.floor(random() * 5_000_000),
    bps: 1 + Math.floor(random() * 9_999),
    installments: 1 + Math.floor(random() * 12),
    uneven: random() < 0.5,
  }));

  it.each(cases)(
    "artist gets exactly their share of $price at $bps bps over $installments payments",
    ({ price, bps, installments, uneven }) => {
      const clock = testClock();
      const start = scenario(price, bps);
      const before = galleryTotals(start, "gal_lowline");
      let { snapshot: s, sale } = createSale(
        start,
        { artworkId: "wrk_salt", buyerName: "Test", installments },
        clock,
      );

      for (let i = 0; i < installments; i++) {
        const isLast = i === installments - 1;
        const due = nextInstallment(s, sale);
        // Uneven buyers pay a bit less early on; the last payment covers the rest.
        const amount =
          uneven && !isLast && due > 1 ? Math.max(1, due - (i + 1)) : undefined;
        const paidSoFar = s.payments
          .filter((p) => p.saleId === sale.id)
          .reduce((t, p) => t + p.amountCents, 0);
        const final = isLast ? price - paidSoFar : amount;
        s = receivePayment(
          s,
          { saleId: sale.id, amountCents: final },
          clock,
        ).snapshot;
      }

      sale = s.sales.find((x) => x.id === sale.id)!;
      expect(sale.status).toBe("paid");

      const holds = s.holds.filter((h) => h.saleId === sale.id);
      const artistTotal = holds.reduce((t, h) => t + h.amountCents, 0);
      expect(artistTotal).toBe(shareOf(price, bps));
      expect(holds.every((h) => h.amountCents >= 0)).toBe(true);
      expect(holds.every((h) => h.status === "paid")).toBe(true);

      const payout = s.payouts.at(-1)!;
      expect(payout.amountCents).toBe(artistTotal);

      // Every cent the buyer paid is either gallery operating money or the artist's.
      const after = galleryTotals(s, "gal_lowline");
      expect(after.operatingCents - before.operatingCents + artistTotal).toBe(
        price,
      );
      expect(after.lockedCents).toBe(before.lockedCents);
    },
  );

  it.each(cases.slice(0, 100))(
    "a buyer backing out of $price after some payments leaves the gallery exactly where it started",
    ({ price, bps, installments }) => {
      if (installments < 2) return;
      const clock = testClock();
      const start = scenario(price, bps);
      const before = galleryTotals(start, "gal_lowline");
      let { snapshot: s, sale } = createSale(
        start,
        { artworkId: "wrk_salt", buyerName: "Test", installments },
        clock,
      );
      for (let i = 0; i < installments - 1; i++) {
        s = receivePayment(s, { saleId: sale.id }, clock).snapshot;
      }
      s = cancelSale(s, { saleId: sale.id }, clock).snapshot;
      sale = s.sales.find((x) => x.id === sale.id)!;

      const after = galleryTotals(s, "gal_lowline");
      expect(sale.status).toBe("cancelled");
      expect(after.operatingCents).toBe(before.operatingCents);
      expect(after.lockedCents).toBe(before.lockedCents);
      expect(after.paidToArtistsCents).toBe(before.paidToArtistsCents);
      expect(s.artworks.find((w) => w.id === "wrk_salt")!.status).toBe(
        "consigned",
      );
    },
  );
});
