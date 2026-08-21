import { NextRequest, NextResponse } from "next/server";
import { inspectDatabase, jsonRows, openReadonly, resolveDatabase } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChartPoint = { name: string; value: number };

function values(db: ReturnType<typeof openReadonly>, sql: string, ...params: (string | number)[]) {
  try {
    return jsonRows(db.prepare(sql).all(...params) as Record<string, unknown>[]);
  } catch {
    return [];
  }
}

export function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("database") ?? "";
    const path = resolveDatabase(id);
    const info = inspectDatabase(path);
    const names = new Set(info.tables.map((table) => table.name));
    const db = openReadonly(path);
    try {
      let activity: Record<string, unknown>[] = [];
      let breakdown: Record<string, unknown>[] = [];
      let insight = "This store is shown through its discovered schema and on-disk allocation.";

      if (names.has("logs")) {
        const now = Math.floor(Date.now() / 1000);
        const since = now - 24 * 60 * 60;
        activity = values(db, `SELECT strftime('%H:00', ts, 'unixepoch', 'localtime') AS name, COUNT(*) AS value FROM logs WHERE ts >= ? GROUP BY strftime('%Y-%m-%d %H', ts, 'unixepoch', 'localtime') ORDER BY MIN(ts)`, since);
        breakdown = values(db, "SELECT level AS name, COUNT(*) AS value FROM logs WHERE ts >= ? GROUP BY level ORDER BY value DESC", since);
        insight = "Activity and levels cover the last 24 hours, using the timestamp index so the live log store stays responsive.";
      } else if (names.has("threads")) {
        const sinceMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
        activity = values(db, `SELECT strftime('%m-%d', COALESCE(created_at_ms, created_at * 1000) / 1000, 'unixepoch', 'localtime') AS name, COUNT(*) AS value FROM threads WHERE COALESCE(created_at_ms, created_at * 1000) >= ? GROUP BY name ORDER BY MIN(COALESCE(created_at_ms, created_at * 1000))`, sinceMs);
        breakdown = values(db, "SELECT COALESCE(NULLIF(model, ''), model_provider, 'unknown') AS name, COUNT(*) AS value FROM threads GROUP BY 1 ORDER BY value DESC LIMIT 8");
        insight = "Thread activity covers the last 30 days; the breakdown shows the most common recorded models or providers.";
      } else if (names.has("stage1_outputs")) {
        activity = values(db, `SELECT strftime('%m-%d', generated_at, 'unixepoch', 'localtime') AS name, COUNT(*) AS value FROM stage1_outputs GROUP BY name ORDER BY MIN(generated_at)`);
        breakdown = values(db, "SELECT CASE selected_for_phase2 WHEN 1 THEN 'Selected for phase 2' ELSE 'Stage 1 only' END AS name, COUNT(*) AS value FROM stage1_outputs GROUP BY selected_for_phase2");
        insight = "The chart follows memory artifacts by generation date; selection shows which outputs advanced to phase 2.";
      } else if (names.has("thread_goals")) {
        activity = values(db, `SELECT strftime('%m-%d', created_at_ms / 1000, 'unixepoch', 'localtime') AS name, COUNT(*) AS value FROM thread_goals GROUP BY name ORDER BY MIN(created_at_ms)`);
        breakdown = values(db, "SELECT status AS name, COUNT(*) AS value FROM thread_goals GROUP BY status ORDER BY value DESC");
        insight = "Goal status is read directly from the goal ledger; activity groups goals by creation date.";
      } else if (names.has("automations")) {
        activity = values(db, `SELECT strftime('%m-%d', created_at, 'unixepoch', 'localtime') AS name, COUNT(*) AS value FROM automations GROUP BY name ORDER BY MIN(created_at)`);
        breakdown = values(db, "SELECT status AS name, COUNT(*) AS value FROM automations GROUP BY status ORDER BY value DESC");
        insight = "Automation activity and current statuses are summarized from the local app database.";
      }

      if (!activity.length) {
        activity = info.tables
          .filter((table) => (table.allocatedBytes ?? 0) > 0)
          .map((table) => ({ name: table.name, value: table.allocatedBytes ?? 0 }))
          .sort((a, b) => Number(b.value) - Number(a.value))
          .slice(0, 12);
      }
      if (!breakdown.length) {
        breakdown = info.tables
          .map((table) => ({ name: table.name, value: table.rowEstimate ?? 0 }))
          .sort((a, b) => Number(b.value) - Number(a.value))
          .slice(0, 8);
      }

      const totalRows = info.tables.reduce((sum, table) => sum + (table.rowEstimate ?? 0), 0);
      return NextResponse.json({
        metrics: {
          size: info.size,
          tables: info.tables.length,
          rows: totalRows,
          modifiedAt: info.modifiedAt,
        },
        activity: activity as ChartPoint[],
        breakdown: breakdown as ChartPoint[],
        insight,
      });
    } finally {
      db.close();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not analyze database." }, { status: 400 });
  }
}
