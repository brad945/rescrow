import type { AgreementTerms, ConsignmentAgreement } from "@/types";
import { FIXTURE_TERMS } from "@/lib/seed";
import { EscrowError } from "@/lib/escrow/engine";

export interface AgentResult {
  terms: AgreementTerms;
  source: "model" | "fixture";
}

/**
 * Reads a consignment agreement and returns the terms that drive escrow.
 * The backend lane replaces the body with the gpt-oss call; the fixture path
 * stays as the fallback when Ollama is not running.
 */
export async function readAgreement(
  agreement: ConsignmentAgreement,
): Promise<AgentResult> {
  const fixture = FIXTURE_TERMS[agreement.id];
  if (!fixture) {
    throw new EscrowError(
      `The agent could not read agreement ${agreement.id}; no saved answer exists and no model is connected`,
    );
  }
  return { terms: fixture, source: "fixture" };
}
