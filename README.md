# Codex DB Explorer

A local Next.js interface for exploring Codex SQLite databases, the complete Markdown memory corpus, and JSONL session history.

> **Runs on your machine, against your data.** No telemetry, no external services, no data leaves your device.

## What it does

- Discovers SQLite stores in `~/.codex` and `~/.codex/sqlite`
- Adapts to schema changes through live table, column, index, and foreign-key discovery
- Adds focused analytics for logs, threads, memories, goals, and automations
- Browses tables with pagination, search, sorting, and expanded row details
- Runs guarded `SELECT`, `WITH`, and `EXPLAIN QUERY PLAN` statements
- Exports query results to CSV
- Discovers every Markdown file under `~/.codex/memories`
- Analyzes corpus size, structure, directories, and frequent terms
- Searches all memory content with file and line-level matches
- Edits Markdown with a GFM preview, stale-revision detection, and atomic replacement
- Indexes every JSONL file under `~/.codex/sessions` without scanning the full archive on page load
- Browses human messages and tool calls with per-session event analysis
- Streams complete transcripts on demand and exposes every file through a bounded, byte-paginated Raw JSONL viewer
- Searches session contents explicitly with a bounded full-text scan

## Privacy & security

- Databases are opened with SQLite's read-only flag; the query endpoint rejects write and schema-changing statements.
- Memory files change only when you explicitly press **Save**. Immediately before an atomic replacement, a revision hash rejects a stale editor copy.
- Session files are strictly read-only. Large previews state exactly why content was omitted. A complete transcript scan reads the full file while retaining at most 20,000 entries; the Raw JSONL viewer reads one fixed-size byte page at a time.
- The app reads whatever is in `~/.codex` — that can include prompts, conversations, and memories. Treat any screenshot, CSV export, or shared query result as potentially sensitive.
- Intended for `localhost` only. The API routes have **no authentication**, so anyone who can reach the port can read databases and edit memory Markdown. Do not deploy this or bind it to a public interface.
- CSV exports are written wherever your browser downloads go and are gitignored inside this repo by default.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CODEX_HOME` | `~/.codex` | Root directory scanned for SQLite stores |
| `CODEX_DB_DIRECTORY` | – | Additional directory of SQLite files to include |
| `CODEX_MEMORY_DIRECTORY` | `$CODEX_HOME/memories` | Markdown memory root |
| `CODEX_SESSIONS_DIRECTORY` | `$CODEX_HOME/sessions` | JSONL session archive root |

```bash
CODEX_DB_DIRECTORY=/absolute/path/to/databases npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

Node 24 or newer is recommended because the app uses the built-in `node:sqlite` module and does not need a native SQLite package.
Session full-text search also expects [`rg` (ripgrep)](https://github.com/BurntSushi/ripgrep) on `PATH`.

## License

[MIT](LICENSE)
