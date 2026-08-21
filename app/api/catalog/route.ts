import { NextResponse } from "next/server";
import { catalog } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    return NextResponse.json({ databases: catalog(), scannedAt: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not scan databases." }, { status: 500 });
  }
}
