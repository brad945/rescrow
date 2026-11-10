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
  /** Why a live read fell back to the saved answer, when it did. */
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

// A warm model answers in about 11s on a laptop; past this it falls back.
const timeoutMs = () => Number(process.env.RESCROW_AGENT_TIMEOUT_MS ?? 45_000);

/** Live callbacks while the model writes: its answer and its reasoning. */
export interface StreamHandlers {
  onToken?: (t: string) => void;
  onThinking?: (t: string) => void;
}

/** Runs the local model on any agreement text and verifies what it says. */
export async function extractTerms(
  text: string,
  handlers: StreamHandlers = {},
): Promise<{ terms: AgreementTerms; verified: boolean }> {
  const { reply, model } = await chat({
    system: SYSTEM_PROMPT,
    user: text,
    format: modelOutputJsonSchema,
    timeoutMs: timeoutMs(),
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
  const { terms, verified } = verify(text, parsed.data);
  return { terms: { ...terms, model }, verified };
}

function saved(agreement: ConsignmentAgreement): AgentResult {
  const fixture = FIXTURE_TERMS[agreement.id];
  if (!fixture) {
    throw new EscrowError(
      `No saved answer for agreement ${agreement.id}; read it with mode "live"`,
    );
  }
  return {
    terms: { ...fixture, confidence: "high" },
    source: "fixture",
    verified: true,
  };
}

/**
 * Reads a stored agreement.
 * - mode "saved" (default) returns the saved answer.
 * - mode "live" asks the local model. If the model is unreachable, slow, or
 *   returns something unusable, it falls back to the saved answer and reports
 *   why. RESCROW_AGENT=fixture turns live reads off entirely.
 */
export async function readAgreement(
  agreement: ConsignmentAgreement,
  mode: "saved" | "live" = "saved",
  handlers: StreamHandlers = {},
): Promise<AgentResult> {
  if (mode === "saved" || process.env.RESCROW_AGENT === "fixture") {
    return saved(agreement);
  }
  try {
    const { terms, verified } = await extractTerms(agreement.text, handlers);
    return { terms, source: "model", verified };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[agent] live read failed on ${agreement.id}: ${reason}`);
    if (!FIXTURE_TERMS[agreement.id]) {
      throw new EscrowError(
        `The agent could not read this agreement (${reason}). Is Ollama running?`,
      );
    }
    return { ...saved(agreement), fallbackReason: reason };
  }
}
