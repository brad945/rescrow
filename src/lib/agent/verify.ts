import { z } from "zod";
import type { AgreementTerms, VerificationCheck } from "@/types";
import { states } from "./numbers";

/** What the model is asked to return. Every number travels with its quote. */
export const modelOutputSchema = z.object({
  artistSharePercent: z.number().min(0).max(100),
  shareQuote: z.string(),
  payoutDays: z.number().int().min(0).max(3650).nullable(),
  payoutQuote: z.string().nullable(),
  notes: z
    .array(z.object({ text: z.string(), quote: z.string() }))
    .max(4)
    .default([]),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** JSON schema handed to Ollama so the model can only emit this shape. */
export const modelOutputJsonSchema = {
  type: "object",
  properties: {
    artistSharePercent: { type: "number" },
    shareQuote: { type: "string" },
    payoutDays: { type: ["integer", "null"] },
    payoutQuote: { type: ["string", "null"] },
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, quote: { type: "string" } },
        required: ["text", "quote"],
      },
    },
  },
  required: [
    "artistSharePercent",
    "shareQuote",
    "payoutDays",
    "payoutQuote",
    "notes",
  ],
} as const;

const squash = (s: string) =>
  s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** Regex for one character of a quote, matching straight or curly quotes. */
function charPattern(ch: string): string {
  if (ch === "'") return "['\u2018\u2019]";
  if (ch === '"') return '["\u201C\u201D]';
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds the quote in the agreement, tolerating only whitespace and straight
 * versus curly quote marks, and returns the agreement's own wording so
 * highlights line up exactly.
 */
export function locate(text: string, quote: string): string | null {
  const q = squash(quote).replace(/[.;,]$/, "");
  if (q.length < 8) return null;
  if (text.includes(q)) return q;
  // Rebuild a tolerant pattern from the quote's words.
  const pattern = q
    .split(" ")
    .map((w) => [...w].map(charPattern).join(""))
    .join("\\s+");
  const m = text.match(new RegExp(pattern));
  return m ? m[0] : null;
}

export interface Verified {
  terms: AgreementTerms;
  /** False when any number could not be traced to the agreement. */
  verified: boolean;
}

/**
 * Turns model output into terms Rescrow can act on. A number is only trusted
 * when its quote appears in the agreement and the quote states that number
 * (or, for the split, the gallery's side of it).
 */
export function verify(text: string, out: ModelOutput): Verified {
  const checks: VerificationCheck[] = [];
  const citations: string[] = [];
  const pct = Math.round(out.artistSharePercent * 100) / 100;

  const unverified: string[] = [];
  const shareQuote = locate(text, out.shareQuote);
  if (!shareQuote) unverified.push(out.shareQuote);
  checks.push({
    label: "Split quote is in the agreement",
    ok: shareQuote !== null,
    detail: shareQuote ? `"${shareQuote}"` : "Quote not found word for word",
  });
  if (shareQuote) citations.push(shareQuote);

  const shareStated =
    shareQuote !== null &&
    (states(shareQuote, pct) || states(shareQuote, 100 - pct));
  checks.push({
    label: `Quote supports ${pct}% to the artist`,
    ok: shareStated,
    detail: shareStated
      ? states(shareQuote!, pct)
        ? `States ${pct}%`
        : `States the gallery's ${100 - pct}%, so the artist gets ${pct}%`
      : "The quote does not state this number",
  });

  let daysOk = false;
  if (out.payoutDays !== null && out.payoutQuote) {
    const payoutQuote = locate(text, out.payoutQuote);
    if (payoutQuote) citations.push(payoutQuote);
    else unverified.push(out.payoutQuote);
    daysOk = payoutQuote !== null && states(payoutQuote, out.payoutDays);
    checks.push({
      label: `Quote supports payment within ${out.payoutDays} days`,
      ok: daysOk,
      detail: daysOk
        ? `"${payoutQuote}"`
        : payoutQuote
          ? "The quote does not state this number of days"
          : "Quote not found word for word",
    });
  } else {
    checks.push({
      label: "Payout deadline",
      ok: false,
      detail: "The agreement does not set one; a person must confirm",
    });
  }

  const notes: string[] = [];
  for (const note of out.notes) {
    const quote = locate(text, note.quote);
    if (!quote) {
      unverified.push(note.quote); // The note itself is dropped, not shown.
      continue;
    }
    notes.push(note.text);
    citations.push(quote);
  }

  return {
    terms: {
      artistShareBps: Math.round(pct * 100),
      payoutDays: out.payoutDays ?? 0,
      notes,
      citations: [...new Set(citations)],
      checks,
      confidence: checks.every((c) => c.ok) ? "high" : "needs_review",
      unverifiedCitations: unverified,
    },
    verified: checks.every((c) => c.ok),
  };
}
