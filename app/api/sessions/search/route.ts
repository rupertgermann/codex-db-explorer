import { type NextRequest, NextResponse } from "next/server";
import { SessionRepository, SessionSearchError } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (query.length < 3) throw new Error("Enter at least 3 characters.");
    if (query.length > 200) throw new Error("Search queries are limited to 200 characters.");
    const results = await new SessionRepository().search(query);
    return NextResponse.json(
      { query, results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not search Codex sessions." },
      { status: error instanceof SessionSearchError ? 408 : 400 },
    );
  }
}
