import { NextResponse } from "next/server";
import { warm } from "@/lib/agent/ollama";

/** POST loads the local model so the demo's first agent call is quick. */
export async function POST() {
  if (process.env.RESCROW_AGENT === "fixture") {
    return NextResponse.json({ ready: false, reason: "agent off" });
  }
  return NextResponse.json({ ready: await warm() });
}
