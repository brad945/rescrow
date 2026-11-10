import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { createSale } from "@/lib/escrow/engine";
import { mutate } from "@/lib/store";
import type { CreateSaleRequest } from "@/types";

const schema: z.ZodType<CreateSaleRequest> = z.object({
  artworkId: z.string(),
  buyerName: z.string().trim().max(80),
  installments: z.number().int().min(1).max(12),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = await mutate((current) => {
      const out = createSale(current, body);
      return { snapshot: out.snapshot, result: out.sale };
    });
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
