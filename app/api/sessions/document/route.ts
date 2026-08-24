import { type NextRequest, NextResponse } from "next/server";
import { SessionPathError, SessionRepository } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path") ?? "";
    const session = await new SessionRepository().read(path);
    return NextResponse.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read Codex session." },
      { status: error instanceof SessionPathError ? 404 : 500 },
    );
  }
}
