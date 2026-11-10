import { NextResponse } from "next/server";
import { z } from "zod";
import { EscrowError } from "@/lib/escrow/engine";

/** Parses a JSON body against a schema, or throws a 400-worthy error. */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>) {
  const raw: unknown = await req.json().catch(() => {
    throw new EscrowError("Request body must be JSON");
  });
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new EscrowError(z.prettifyError(result.error));
  }
  return result.data;
}

/** Turns known rule violations into 400s and logs anything unexpected. */
export function errorResponse(err: unknown) {
  if (err instanceof EscrowError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
