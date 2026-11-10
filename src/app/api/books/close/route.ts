import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { clockFor, closePeriod, releaseDueHolds } from "@/lib/escrow/engine";
import { mutate } from "@/lib/store";
import type { ClosePeriodRequest } from "@/types";

const schema: z.ZodType<ClosePeriodRequest> = z.object({
  galleryId: z.string(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

/**
 * Close a month of the gallery's books. Any share that reached its deadline
 * since the last poll is paid first, exactly as /api/state does, then the
 * close runs its gates. A refusal is a 400 naming every failure.
 */
export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = await mutate((current) => {
      const paid = releaseDueHolds(current, clockFor(current));
      return {
        snapshot: closePeriod(paid, body, clockFor(paid)).snapshot,
        result: null,
      };
    });
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
