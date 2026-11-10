import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody } from "@/lib/api";
import { declareInsolvency } from "@/lib/escrow/engine";
import { mutate } from "@/lib/store";
import type { InsolvencyRequest } from "@/types";

const schema: z.ZodType<InsolvencyRequest> = z.object({
  galleryId: z.string(),
});

/** Demo beat: the gallery fails. Creditors take operating; trust goes to artists. */
export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const { snapshot } = await mutate((current) => ({
      snapshot: declareInsolvency(current, body).snapshot,
      result: null,
    }));
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
