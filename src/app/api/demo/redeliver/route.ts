import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { clockFor, EscrowError, receivePayment } from "@/lib/escrow/engine";
import { mutate } from "@/lib/store";
import type { RedeliverRequest } from "@/types";

const schema: z.ZodType<RedeliverRequest> = z.object({
  galleryId: z.string(),
});

/**
 * Demo beat: the bank feed redelivers the gallery's latest transaction, the
 * way an overlapping poll window would. It goes through the same
 * receivePayment as any payment, which recognises the id and books nothing.
 */
export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = await mutate((current) => {
      const last = current.payments
        .filter((p) => p.galleryId === body.galleryId && p.rampTransactionId)
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
        .at(-1);
      if (!last) throw new EscrowError("No bank transaction to redeliver");
      const out = receivePayment(
        current,
        {
          saleId: last.saleId,
          amountCents: last.amountCents,
          method: last.method,
          rampTransactionId: last.rampTransactionId,
        },
        clockFor(current),
      );
      return { snapshot: out.snapshot, result: null };
    });
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
