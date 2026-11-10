import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { cancelSale, clockFor } from "@/lib/escrow/engine";
import { mutate } from "@/lib/store";
import type { CancelSaleRequest } from "@/types";

const schema: z.ZodType<CancelSaleRequest> = z.object({ saleId: z.string() });

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = await mutate((current) => {
      const out = cancelSale(current, body, clockFor(current));
      return { snapshot: out.snapshot, result: out.sale };
    });
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
