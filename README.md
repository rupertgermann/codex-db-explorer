# Codex Atlas

A local, read-only Next.js interface for exploring and analyzing Codex SQLite databases.

## What it does

- Discovers SQLite stores in `~/.codex` and `~/.codex/sqlite`
- Adapts to schema changes through live table, column, index, and foreign-key discovery
- Adds focused analytics for logs, threads, memories, goals, and automations
- Browses tables with pagination, search, sorting, and expanded row details
- Runs guarded `SELECT`, `WITH`, and `EXPLAIN QUERY PLAN` statements
- Exports query results to CSV

The server opens every database with SQLite's read-only flag. The query endpoint also rejects write and schema-changing statements.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

To include another directory of SQLite files:

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
