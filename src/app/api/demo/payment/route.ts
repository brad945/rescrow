import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { clockFor, receivePayment } from "@/lib/escrow/engine";
import { mutate } from "@/lib/store";
import type { ReceivePaymentRequest } from "@/types";

const schema: z.ZodType<ReceivePaymentRequest> = z.object({
  saleId: z.string(),
  amountCents: z.number().int().positive().optional(),
  method: z.enum(["wire", "ach", "card"]).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = await mutate((current) => {
      const out = receivePayment(current, body, clockFor(current));
      return { snapshot: out.snapshot, result: out.hold };
    });
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
