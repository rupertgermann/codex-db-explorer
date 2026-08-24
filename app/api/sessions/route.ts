import { NextResponse } from "next/server";
import { SessionRepository } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    return NextResponse.json(new SessionRepository().catalog(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not inspect Codex sessions." },
      { status: 500 },
    );
  }
}
