import { NextResponse } from "next/server";
import { load } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(load());
}
