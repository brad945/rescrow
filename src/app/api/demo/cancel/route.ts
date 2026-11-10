import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { cancelSale } from "@/lib/escrow/engine";
import { load, save } from "@/lib/store";
import type { CancelSaleRequest } from "@/types";

const schema: z.ZodType<CancelSaleRequest> = z.object({ saleId: z.string() });

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = cancelSale(load(), body);
    save(snapshot);
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
