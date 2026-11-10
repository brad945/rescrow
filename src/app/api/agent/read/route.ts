import { NextResponse } from "next/server";
import { z } from "zod";
import { readAgreement, type StreamHandlers } from "@/lib/agent";
import { errorResponse, parseBody } from "@/lib/api";
import { applyTerms, EscrowError } from "@/lib/escrow/engine";
import { ndjsonStream } from "@/lib/ndjson";
import { load, mutate } from "@/lib/store";
import type { ReadAgreementRequest } from "@/types";

const schema: z.ZodType<ReadAgreementRequest> = z.object({
  agreementId: z.string(),
  mode: z.enum(["saved", "live"]).optional(),
});

async function run(
  agreementId: string,
  mode: "saved" | "live",
  handlers: StreamHandlers = {},
) {
  const agreement = load().agreements.find((a) => a.id === agreementId);
  if (!agreement) {
    throw new EscrowError(`Agreement ${agreementId} not found`);
  }
  const result = await readAgreement(agreement, mode, handlers);
  // The model call can take a while; apply its result to the latest state,
  // not the copy loaded before the call, so nothing done meanwhile is lost.
  const { snapshot } = await mutate((current) => ({
    snapshot: applyTerms(current, {
      agreementId: agreement.id,
      terms: result.terms,
      source: result.source,
      flag: result.fallbackReason,
    }),
    result: null,
  }));
  return { snapshot, result };
}

/**
 * POST { agreementId, mode? }. mode "live" asks the local model; the default
 * "saved" returns the stored answer. Add ?stream=1 to receive the model's output as it is
 * written, as newline-delimited JSON: {type:"token"} events, then {type:"done"}.
 */
export async function POST(req: Request) {
  let body: ReadAgreementRequest;
  try {
    body = await parseBody(req, schema);
  } catch (err) {
    return errorResponse(err);
  }

  if (new URL(req.url).searchParams.get("stream") === "1") {
    return ndjsonStream(async (send) => {
      const { snapshot, result } = await run(
        body.agreementId,
        body.mode ?? "saved",
        {
          onToken: (text) => send({ type: "token", text }),
          onThinking: (text) => send({ type: "thinking", text }),
        },
      );
      send({
        type: "done",
        snapshot,
        source: result.source,
        verified: result.verified,
        fallbackReason: result.fallbackReason ?? null,
      });
    });
  }

  try {
    const { snapshot } = await run(body.agreementId, body.mode ?? "saved");
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
