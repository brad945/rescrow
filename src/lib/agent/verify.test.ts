import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/seed";
import { locate, verify, type ModelOutput } from "./verify";

const ines = createSeed().agreements.find((a) => a.id === "agr_ines")!.text;
const theo = createSeed().agreements.find((a) => a.id === "agr_theo")!.text;

const good: ModelOutput = {
  artistSharePercent: 50,
  shareQuote: "the Gallery keeps half and the Artist keeps half",
  payoutDays: 60,
  payoutQuote: "no later than sixty (60) days following receipt by the Gallery",
  notes: [
    {
      text: "Discounts over 10% need the artist's approval.",
      quote:
        "Any discount above ten percent requires the Artist's written approval",
    },
  ],
};

describe("verify", () => {
  it("accepts numbers that are backed by exact quotes", () => {
    const { terms, verified } = verify(ines, good);
    expect(verified).toBe(true);
    expect(terms.artistShareBps).toBe(5000);
    expect(terms.payoutDays).toBe(60);
    expect(terms.citations).toHaveLength(3);
    for (const c of terms.citations) expect(ines).toContain(c);
  });

  it("flags a split the quote does not support", () => {
    const { verified, terms } = verify(ines, {
      ...good,
      artistSharePercent: 70,
    });
    expect(verified).toBe(false);
    expect(terms.checks!.find((c) => c.label.includes("70%"))!.ok).toBe(false);
  });

  it("flags a made-up quote and keeps it out of the citations", () => {
    const { verified, terms } = verify(ines, {
      ...good,
      shareQuote: "The artist receives half of all proceeds.",
    });
    expect(verified).toBe(false);
    expect(terms.citations).not.toContain(
      "The artist receives half of all proceeds.",
    );
  });

  it("drops notes whose quote is not in the agreement", () => {
    const { terms } = verify(ines, {
      ...good,
      notes: [{ text: "Invented perk", quote: "Artist gets a free lunch" }],
    });
    expect(terms.notes).toEqual([]);
  });

  it("accepts a split stated from the gallery's side", () => {
    const { verified, terms } = verify(theo, {
      artistSharePercent: 60,
      shareQuote: "the Gallery receives forty percent (40%)",
      payoutDays: 14,
      payoutQuote:
        "remitted within fourteen (14) days after the Gallery receives cleared funds",
      notes: [],
    });
    expect(verified).toBe(true);
    expect(terms.checks![1].detail).toMatch(/gallery's 40%/);
  });

  it("needs a person when the agreement sets no deadline", () => {
    const { verified } = verify(ines, {
      ...good,
      payoutDays: null,
      payoutQuote: null,
    });
    expect(verified).toBe(false);
  });
});

describe("locate", () => {
  it("tolerates line breaks and trailing punctuation in the quote", () => {
    expect(
      locate(
        "keeps half and\nthe Artist keeps half.",
        "keeps half and the Artist keeps half.",
      ),
    ).toBe("keeps half and\nthe Artist keeps half");
  });
});
