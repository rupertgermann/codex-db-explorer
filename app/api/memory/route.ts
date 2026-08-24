import { NextResponse } from "next/server";
import { MemoryRepository } from "@/lib/memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    return NextResponse.json(new MemoryRepository().catalog(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not inspect Codex memory." },
      { status: 500 },
    );
  }
}
