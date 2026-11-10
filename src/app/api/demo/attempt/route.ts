import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { attemptTrustMove, clockFor } from "@/lib/escrow/engine";
import { mutate } from "@/lib/store";
import type { TrustMoveRequest } from "@/types";

const schema: z.ZodType<TrustMoveRequest> = z.object({
  saleId: z.string(),
  kind: z.enum(["rent", "creditor"]),
});

/**
 * Demo beat: the gallery tries to spend a sale's trust money. The refusal is
 * the expected outcome, so this returns 200 with the Snapshot (the refusal is
 * in the activity feed). A bad body, or nothing in trust, is a 400.
 */
export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = await mutate((current) => ({
      snapshot: attemptTrustMove(current, body, clockFor(current)).snapshot,
      result: null,
    }));
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
