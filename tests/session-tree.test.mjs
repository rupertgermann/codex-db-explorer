import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSessionForest, matchingSessionPaths, sessionArchiveNavigation } from "../lib/session-tree.ts";

function session(id, parentThreadId = "", startedAt = 0) {
  return { id, path: `${id}.jsonl`, parentThreadId, startedAt };
}

test("builds multiple roots with nested session children", () => {
  const forest = buildSessionForest([
    session("root-a", "", 5),
    session("child-a", "root-a", 4),
    session("grandchild-a", "child-a", 3),
    session("root-b", "", 2),
  ]);

  assert.deepEqual(forest.map((node) => [
    node.session.id,
    node.children.map((child) => [child.session.id, child.children.map((grandchild) => grandchild.session.id)]),
  ]), [
    ["root-a", [["child-a", ["grandchild-a"]]]],
    ["root-b", []],
  ]);
});

test("surfaces a session with a missing parent as an orphan root", () => {
  const forest = buildSessionForest([session("orphan", "deleted-parent")]);

  assert.equal(forest.length, 1);
  assert.equal(forest[0].session.id, "orphan");
  assert.equal(forest[0].orphan, true);
});

test("surfaces a parent cycle once without recursing forever", () => {
  const forest = buildSessionForest([
    session("cycle-a", "cycle-b", 2),
    session("cycle-b", "cycle-a", 1),
  ]);

  assert.equal(forest.length, 1);
  assert.equal(forest[0].cycle, true);
  assert.deepEqual([forest[0].session.id, ...forest[0].children.map((child) => child.session.id)], ["cycle-a", "cycle-b"]);
  assert.deepEqual(forest[0].children[0].children, []);
});

test("keeps context ancestors while pruning unrelated filtered branches", () => {
  const forest = buildSessionForest([
    session("root"),
    session("context-parent", "root"),
    session("match", "context-parent"),
    session("unrelated", "root"),
  ], new Set(["match.jsonl"]));

  assert.equal(forest.length, 1);
  assert.equal(forest[0].session.id, "root");
  assert.equal(forest[0].contextOnly, true);
  assert.equal(forest[0].children[0].session.id, "context-parent");
  assert.equal(forest[0].children[0].contextOnly, true);
  assert.equal(forest[0].children[0].children[0].session.id, "match");
  assert.equal(forest[0].children[0].children[0].contextOnly, false);
  assert.equal(forest[0].children.length, 1);
});

test("combines project, month, provenance, and content-search filters", () => {
  const august = Date.parse("2026-08-10T12:00:00Z");
  const sessions = [
    { ...session("match", "", august), project: "alpha", provenance: "codex" },
    { ...session("wrong-origin", "", august), project: "alpha", provenance: "user" },
    { ...session("wrong-project", "", august), project: "beta", provenance: "codex" },
    { ...session("wrong-month", "", Date.parse("2026-07-10T12:00:00Z")), project: "alpha", provenance: "codex" },
    { ...session("not-in-search", "", august), project: "alpha", provenance: "codex" },
  ];

  const matches = matchingSessionPaths(sessions, {
    project: "alpha",
    month: "2026-08",
    provenance: "codex",
    contentPaths: new Set(["match.jsonl", "wrong-origin.jsonl", "wrong-project.jsonl", "wrong-month.jsonl"]),
  });

  assert.deepEqual([...matches], ["match.jsonl"]);
});

test("builds a 4,000-session forest with 450 direct children promptly", () => {
  const sessions = [session("large-parent", "", 5_000)];
  sessions.push(...Array.from({ length: 450 }, (_, index) => session(`child-${index}`, "large-parent", 4_999 - index)));
  sessions.push(...Array.from({ length: 3_549 }, (_, index) => session(`root-${index}`, "", 3_999 - index)));

  const started = performance.now();
  const forest = buildSessionForest(sessions);
  const elapsed = performance.now() - started;

  assert.equal(forest.length, 3_550);
  assert.equal(forest.find((node) => node.session.id === "large-parent")?.children.length, 450);
  assert.ok(elapsed < 1_000, `Expected the forest in under 1 second, received ${elapsed.toFixed(1)} ms`);
});

test("preserves selection and expansion while switching archive views", () => {
  const initial = {
    view: "list",
    selectedPath: "child.jsonl",
    expandedThreads: new Set(["root.jsonl"]),
  };

  const tree = sessionArchiveNavigation(initial, { type: "view", view: "tree" });
  const collapsed = sessionArchiveNavigation(tree, { type: "toggle", key: "root.jsonl" });

  assert.equal(tree.view, "tree");
  assert.equal(tree.selectedPath, "child.jsonl");
  assert.deepEqual([...tree.expandedThreads], ["root.jsonl"]);
  assert.equal(collapsed.selectedPath, "child.jsonl");
  assert.deepEqual([...collapsed.expandedThreads], []);
});
