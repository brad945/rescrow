import { NextResponse } from "next/server";
import { releaseDueHolds } from "@/lib/escrow/engine";
import { load, mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Current state. Any artist share that has reached the deadline in its
 * agreement is paid out first, so nothing can sit in trust past its due date.
 */
export async function GET() {
  const current = load();
  if (releaseDueHolds(current) === current) {
    return NextResponse.json(current);
  }
  const { snapshot } = await mutate((latest) => ({
    snapshot: releaseDueHolds(latest),
    result: null,
  }));
  return NextResponse.json(snapshot);
}
