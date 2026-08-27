import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { After, Given, Then, When, setWorldConstructor } from "@cucumber/cucumber";
import { MemoryForgetService } from "../../lib/memory-forget.ts";
import { MemoryRepository } from "../../lib/memory.ts";

class ForgetWorld {
  base = "";
  root = "";
  before = [];
  sessionBefore = Buffer.alloc(0);
  plan = null;
  result = null;
}

setWorldConstructor(ForgetWorld);

function corpusBytes(root) {
  const visit = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? visit(path) : [[path.slice(root.length + 1), readFileSync(path)]];
  });
  return visit(root);
}

function seed(world, repeated) {
  world.base = mkdtempSync(join(tmpdir(), "codex-forget-acceptance-"));
  world.root = join(world.base, "memories");
  mkdirSync(join(world.root, "rollout_summaries"), { recursive: true });
  mkdirSync(join(world.root, "extensions", "ad_hoc", "notes"), { recursive: true });
  mkdirSync(join(world.root, "sessions"), { recursive: true });
  writeFileSync(join(world.root, "memory_summary.md"), "# Summary\n\n- Keep changes simple and never add speculative features. [ad-hoc note]\n- Preserve unrelated facts.\n");
  writeFileSync(join(world.root, "MEMORY.md"), `# Memory\n\n- Keep changes simple and never add speculative features. [Task 1] [ad-hoc note]\n${repeated ? "- Keep changes simple and never add speculative features. [Task 2] [ad-hoc note]\n" : ""}- Preserve unrelated facts. [Task 1]\n`);
  writeFileSync(join(world.root, "raw_memories.md"), "# Raw\n\n- Keep changes simple and never add speculative features.\n- Preserve unrelated facts.\n");
  writeFileSync(join(world.root, "rollout_summaries", "one.md"), "# Rollout\n\n- Keep changes simple and never add speculative features.\n- Preserve unrelated facts.\n");
  writeFileSync(join(world.root, "extensions", "ad_hoc", "notes", "simplicity.md"), "# Simplicity\n\n- Keep changes simple and never add speculative features.\n");
  writeFileSync(join(world.root, "sessions", "thread.jsonl"), '{"memory":"Keep changes simple"}\n');
  world.before = corpusBytes(world.root);
  world.sessionBefore = readFileSync(join(world.root, "sessions", "thread.jsonl"));
}

Given("a disposable Memory corpus with one exact durable source", function () { seed(this, false); });
Given("a disposable Memory corpus with repeated durable sources", function () { seed(this, true); });

When("I preview the first summary Memory", function () {
  const hash = new MemoryRepository(this.root).read("memory_summary.md").hash;
  this.plan = new MemoryForgetService(this.root, join(this.base, "backups")).preview({ summaryLine: 3, expectedSummaryHash: hash });
});

When("I confirm one exact durable source", function () {
  this.plan = new MemoryForgetService(this.root, join(this.base, "backups")).preview({
    ...this.plan.selection,
    confirmedDurableIds: [this.plan.durableCandidates[0].id],
  });
});

When("I apply the Forget plan", function () {
  this.result = new MemoryForgetService(this.root, join(this.base, "backups")).apply(this.plan);
});

When("the positive Memory resurfaces in a later rollout", function () {
  writeFileSync(join(this.root, "rollout_summaries", "later.md"), "# Later\n\n- Never add speculative features; keep every change simple.\n");
});

Then("the Forget plan is actionable", function () { assert.equal(this.plan.actionable, true); });
Then("the preview has not changed any corpus byte", function () { assert.deepEqual(corpusBytes(this.root), this.before); });
Then("the Forget plan requires a durable source confirmation", function () {
  assert.equal(this.plan.actionable, false);
  assert.equal(this.plan.durableCandidates.length, 2);
});
Then("only the selected Memory is absent", function () {
  assert.doesNotMatch(readFileSync(join(this.root, "MEMORY.md"), "utf8"), /Keep changes simple/);
  assert.match(readFileSync(join(this.root, "MEMORY.md"), "utf8"), /Preserve unrelated/);
});
Then("an external backup manifest exists", function () { assert.ok(existsSync(this.result.manifestPath)); });
Then("the session archive is byte-identical", function () { assert.deepEqual(readFileSync(join(this.root, "sessions", "thread.jsonl")), this.sessionBefore); });
Then("exactly one delete tombstone exists", function () {
  const notes = readdirSync(join(this.root, "extensions", "ad_hoc", "notes"));
  assert.equal(notes.length, 1);
  assert.match(readFileSync(join(this.root, "extensions", "ad_hoc", "notes", notes[0]), "utf8"), /action: delete/);
});
Then("post-apply verification reports suppression", function () { assert.equal(this.result.verification, "suppressed"); });
Then("the manual recheck reports the later rollout", function () {
  const recheck = new MemoryForgetService(this.root, join(this.base, "backups")).recheck(this.plan);
  assert.equal(recheck.status, "resurfaced");
  assert.deepEqual(recheck.resurfaced.map(({ path }) => path), ["rollout_summaries/later.md"]);
});

After(function () { if (this.base) rmSync(this.base, { recursive: true, force: true }); });
