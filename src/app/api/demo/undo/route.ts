import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { EscrowError } from "@/lib/escrow/engine";
import { undo } from "@/lib/store";

/** Steps the demo back to the state before the last change (key ←). */
export async function POST() {
  try {
    const snapshot = await undo();
    if (!snapshot) throw new EscrowError("Nothing to go back to");
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
