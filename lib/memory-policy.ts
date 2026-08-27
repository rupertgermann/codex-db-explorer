export const AGGREGATE_MEMORY_PATHS = ["memory_summary.md", "MEMORY.md", "raw_memories.md"] as const;
const aggregateMemoryPaths = new Set<string>(AGGREGATE_MEMORY_PATHS);

export function isAggregateMemoryPath(path: string) {
  return aggregateMemoryPaths.has(path);
}
