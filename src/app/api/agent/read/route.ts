import { NextResponse } from "next/server";
import { z } from "zod";
import { readAgreement } from "@/lib/agent";
import { errorResponse, parseBody } from "@/lib/api";
import { applyTerms, EscrowError } from "@/lib/escrow/engine";
import { load, mutate } from "@/lib/store";
import type { ReadAgreementRequest } from "@/types";

const schema: z.ZodType<ReadAgreementRequest> = z.object({
  agreementId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const agreement = load().agreements.find((a) => a.id === body.agreementId);
    if (!agreement) {
      throw new EscrowError(`Agreement ${body.agreementId} not found`);
    }
    const { terms, source } = await readAgreement(agreement);
    // The model call can take a while; apply its result to the latest state,
    // not the copy loaded before the call, so nothing done meanwhile is lost.
    const { snapshot } = await mutate((current) => ({
      snapshot: applyTerms(current, {
        agreementId: agreement.id,
        terms,
        source,
      }),
      result: null,
    }));
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
