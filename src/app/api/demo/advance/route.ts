import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { advanceClock } from "@/lib/escrow/engine";
import { mutate } from "@/lib/store";
import type { AdvanceClockRequest } from "@/types";

const schema: z.ZodType<AdvanceClockRequest> = z.object({
  days: z.number().int().min(1).max(120),
});

/**
 * Demo beat: move the demo clock forward and pay out every share whose
 * agreement deadline has passed. Reset puts the clock back.
 */
export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = await mutate((current) => ({
      snapshot: advanceClock(current, body),
      result: null,
    }));
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
