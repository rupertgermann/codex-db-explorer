import { type NextRequest, NextResponse } from "next/server";
import { MemoryRepository } from "@/lib/memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length > 200) throw new Error("Search queries are limited to 200 characters.");
    return NextResponse.json(
      { query, results: new MemoryRepository().search(query) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not search Codex memory." },
      { status: 400 },
    );
  }
}
