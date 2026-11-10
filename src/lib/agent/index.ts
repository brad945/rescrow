import type { AgreementTerms, ConsignmentAgreement } from "@/types";
import { FIXTURE_TERMS } from "@/lib/seed";
import { EscrowError } from "@/lib/escrow/engine";
import { chat } from "./ollama";
import { modelOutputJsonSchema, modelOutputSchema, verify } from "./verify";

export interface AgentResult {
  terms: AgreementTerms;
  source: "model" | "fixture";
  /** True when every number traced back to an exact quote. */
  verified: boolean;
  /** Why the cached answer was used, when it was. */
  fallbackReason?: string;
}

export const SYSTEM_PROMPT = `You read art consignment agreements for an escrow service that holds an artist's share of each sale in trust.

Return:
- artistSharePercent: the percent of the sale price that belongs to the artist. If the agreement only states the gallery's commission, use 100 minus that commission.
- shareQuote: the clause that states the split.
- payoutDays: how many days after the gallery receives the buyer's payment it must pay the artist. null if the agreement sets no deadline.
- payoutQuote: the clause that states that deadline, or null.
- notes: up to three other terms that change how much the artist is paid or when (deductions, discount rules, installment rules). Each note is one short plain sentence plus the quote it comes from.

Every quote must be copied character for character from the agreement: a single sentence or clause, no paraphrasing, no ellipses. If you cannot quote it, leave it out.`;

const TIMEOUT_MS = Number(process.env.RESCROW_AGENT_TIMEOUT_MS ?? 90_000);

/** Live callbacks while the model writes: its answer and its reasoning. */
export interface StreamHandlers {
  onToken?: (t: string) => void;
  onThinking?: (t: string) => void;
}

/** Runs the model on any agreement text and verifies what it says. */
export async function extractTerms(
  text: string,
  handlers: StreamHandlers = {},
): Promise<{ terms: AgreementTerms; verified: boolean }> {
  const reply = await chat({
    system: SYSTEM_PROMPT,
    user: text,
    format: modelOutputJsonSchema,
    timeoutMs: TIMEOUT_MS,
    ...handlers,
  });
  let raw: unknown;
  try {
    raw = JSON.parse(reply);
  } catch {
    throw new Error("Model reply was not valid JSON");
  }
  const parsed = modelOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Model reply had the wrong shape: ${parsed.error.message}`);
  }
  return verify(text, parsed.data);
}

/**
 * Reads a stored agreement. Uses the local model unless RESCROW_AGENT=fixture;
 * if the model is unreachable or returns something unusable, falls back to the
 * cached answer for the demo agreements and says why.
 */
export async function readAgreement(
  agreement: ConsignmentAgreement,
  handlers: StreamHandlers = {},
): Promise<AgentResult> {
  const fixture = FIXTURE_TERMS[agreement.id];
  if (process.env.RESCROW_AGENT !== "fixture") {
    try {
      const { terms, verified } = await extractTerms(agreement.text, handlers);
      return { terms, source: "model", verified };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[agent] model failed on ${agreement.id}: ${reason}`);
      if (!fixture) {
        throw new EscrowError(
          `The agent could not read this agreement (${reason}). Is Ollama running with ${process.env.RESCROW_MODEL ?? "gpt-oss:20b"}?`,
        );
      }
      return {
        terms: fixture,
        source: "fixture",
        verified: true,
        fallbackReason: reason,
      };
    }
  }
  if (!fixture) {
    throw new EscrowError(
      `No cached answer for ${agreement.id} and the model is turned off (RESCROW_AGENT=fixture)`,
    );
  }
  return { terms: fixture, source: "fixture", verified: true };
}
