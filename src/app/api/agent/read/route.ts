import { NextResponse } from "next/server";
import { z } from "zod";
import { readAgreement } from "@/lib/agent";
import { errorResponse, parseBody } from "@/lib/api";
import { applyTerms, EscrowError } from "@/lib/escrow/engine";
import { load, save } from "@/lib/store";
import type { ReadAgreementRequest } from "@/types";

const schema: z.ZodType<ReadAgreementRequest> = z.object({
  agreementId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const current = load();
    const agreement = current.agreements.find((a) => a.id === body.agreementId);
    if (!agreement) {
      throw new EscrowError(`Agreement ${body.agreementId} not found`);
    }
    const { terms, source } = await readAgreement(agreement);
    const snapshot = applyTerms(current, {
      agreementId: agreement.id,
      terms,
      source,
    });
    save(snapshot);
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
