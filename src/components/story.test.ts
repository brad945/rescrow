import { describe, expect, it } from "vitest";
import {
  applyTerms,
  cancelSale,
  createSale,
  declareInsolvency,
  receivePayment,
} from "@/lib/escrow/engine";
import { createSeed, FIXTURE_TERMS } from "@/lib/seed";
import type { Snapshot } from "@/types";
import { stepFor } from "./story";

/** Plays the story the way the presenter's Next key does. */
function advance(s: Snapshot): Snapshot {
  const step = stepFor(s);
  const next = step.next!;
  const body = next.body as Record<string, unknown>;
  if (next.path === "/api/agent/read") {
    return applyTerms(s, {
      agreementId: body.agreementId as string,
      terms: FIXTURE_TERMS[body.agreementId as string],
      source: "fixture",
    });
  }
  if (next.path === "/api/demo/sale") {
    return createSale(s, body as never).snapshot;
  }
  return receivePayment(s, body as never).snapshot;
}

describe("presenter story", () => {
  it("walks from a fresh seed to a paid artist in five presses", () => {
    let s = createSeed();
    const seen = [stepFor(s).index];
    for (let i = 0; i < 5; i++) {
      s = advance(s);
      seen.push(stepFor(s).index);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stepFor(s).next).toBeUndefined();
    const payout = s.payouts.at(-1)!;
    expect(payout.artistId).toBe("art_ines");
    expect(payout.amountCents).toBe(1_200_000);
  });

  it("offers the cancel ending only once money has moved, and ends there", () => {
    let s = createSeed();
    s = advance(advance(s));
    expect(stepFor(s).canCancel).toBeFalsy();
    s = advance(s);
    expect(stepFor(s).canCancel).toBe(true);
    const sale = s.sales.at(-1)!;
    s = cancelSale(s, { saleId: sale.id }).snapshot;
    expect(stepFor(s).index).toBe(6);
    expect(stepFor(s).next).toBeUndefined();
  });

  it("labels the next payment with the real amount due", () => {
    let s = advance(advance(createSeed()));
    expect(stepFor(s).next!.label).toBe("Wire for $8,000.00 arrives");
    s = advance(advance(s));
    expect(stepFor(s).next!.label).toBe("Final $8,000.00 wire arrives");
  });

  it("offers the gallery failure once money is in trust, then ends with Ines paid", () => {
    let s = createSeed();
    s = advance(advance(s));
    expect(stepFor(s).canFail).toBeFalsy();
    s = advance(advance(s));
    expect(stepFor(s).canFail).toBe(true);
    s = declareInsolvency(s, { galleryId: "gal_lowline" }).snapshot;
    const step = stepFor(s);
    expect(step.index).toBe(7);
    expect(step.next).toBeUndefined();
    expect(step.caption).toMatch(/This time the artist gets paid/);
    // Two payments of $8,000 at 50%: $8,000 was in trust for Ines.
    expect(step.caption).toContain("$8,000.00");
    expect(
      s.payouts.filter((p) => p.artistId === "art_ines").at(-1)!.amountCents,
    ).toBe(800_000);
  });

  it("offers the reviewed terms when the live read fails a check, then moves on", () => {
    let s = applyTerms(createSeed(), {
      agreementId: "agr_ines",
      terms: {
        ...FIXTURE_TERMS.agr_ines,
        checks: [{ label: "Payout deadline", ok: false, detail: "not set" }],
      },
      source: "model",
    });
    const stuck = stepFor(s);
    expect(stuck.next!.label).toBe("Use the reviewed terms on file");
    expect(stuck.next!.body).toEqual({
      agreementId: "agr_ines",
      mode: "saved",
    });
    s = advance(s); // the saved answer has no failed checks
    expect(stepFor(s).next!.label).toBe("Collector buys it");
  });

  it("doesn't claim a live read when the terms came from the saved answer", () => {
    const s = applyTerms(createSeed(), {
      agreementId: "agr_ines",
      terms: FIXTURE_TERMS.agr_ines,
      source: "fixture",
    });
    expect(stepFor(s).caption).toMatch(/^Using the reviewed terms on file/);
    expect(stepFor(s).caption).not.toMatch(/agent pulled/);
  });
});
