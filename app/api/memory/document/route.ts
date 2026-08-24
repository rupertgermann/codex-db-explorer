import { type NextRequest, NextResponse } from "next/server";
import { MemoryConflictError, MemoryPathError, MemoryRepository } from "@/lib/memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path") ?? "";
    return NextResponse.json(new MemoryRepository().read(path), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof MemoryPathError ? 404 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read memory file." },
      { status },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { path?: unknown; content?: unknown; expectedHash?: unknown };
    if (typeof body.path !== "string" || typeof body.content !== "string" || typeof body.expectedHash !== "string") {
      throw new Error("path, content, and expectedHash are required.");
    }
    if (body.content.length > 10_000_000) throw new Error("Memory files are limited to 10 MB.");
    const document = new MemoryRepository().save({
      path: body.path,
      content: body.content,
      expectedHash: body.expectedHash,
    });
    return NextResponse.json(document, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof MemoryConflictError ? 409 : error instanceof MemoryPathError ? 404 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save memory file." },
      { status },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { path?: unknown; expectedHash?: unknown };
    if (typeof body.path !== "string" || typeof body.expectedHash !== "string") {
      throw new Error("path and expectedHash are required.");
    }
    new MemoryRepository().delete({ path: body.path, expectedHash: body.expectedHash });
    return NextResponse.json({ path: body.path }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof MemoryConflictError ? 409 : error instanceof MemoryPathError ? 404 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete memory file." },
      { status },
    );
  }
}
