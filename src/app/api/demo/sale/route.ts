import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { createSale } from "@/lib/escrow/engine";
import { load, save } from "@/lib/store";
import type { CreateSaleRequest } from "@/types";

const schema: z.ZodType<CreateSaleRequest> = z.object({
  artworkId: z.string(),
  buyerName: z.string(),
  installments: z.number().int().min(1).max(12),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = createSale(load(), body);
    save(snapshot);
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
