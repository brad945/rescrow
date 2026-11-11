import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { createSeed } from "@/lib/seed";
import { clearHistory, mutate } from "@/lib/store";

export async function POST() {
  try {
    const { snapshot } = await mutate(() => ({
      snapshot: createSeed(new Date().toISOString()),
      result: null,
    }));
    await clearHistory();
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}
