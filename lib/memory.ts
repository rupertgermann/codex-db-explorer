import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";

export type MemoryFileSummary = {
  path: string;
  name: string;
  directory: string;
  title: string;
  size: number;
  modifiedAt: number;
  words: number;
  headings: number;
  hash: string;
};

export type MemoryDocument = MemoryFileSummary & {
  content: string;
};

export type MemorySearchMatch = {
  line: number;
  excerpt: string;
};

export type MemorySearchResult = {
  path: string;
  title: string;
  matches: MemorySearchMatch[];
  matchCount: number;
};

export type MemoryCatalog = {
  root: string;
  files: MemoryFileSummary[];
  directories: string[];
  totals: { files: number; bytes: number; words: number; headings: number };
  topTerms: { term: string; count: number }[];
};

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "been", "before", "being", "but", "can", "codex", "der", "die", "das",
  "ein", "eine", "for", "from", "has", "have", "into", "ist", "its", "memory", "memories", "mit", "not", "oder",
  "project", "projects", "rollout", "rollouts", "task", "tasks", "that", "the", "their", "then", "this", "und", "use",
  "used", "using", "was", "were", "when", "where", "which", "with", "without", "you", "your",
]);

export class MemoryConflictError extends Error {
  constructor(message = "The memory file changed after it was opened. Reload it and try again.") {
    super(message);
    this.name = "MemoryConflictError";
  }
}

export class MemoryPathError extends Error {
  constructor(message = "The requested Markdown file is outside the memory directory.") {
    super(message);
    this.name = "MemoryPathError";
  }
}

export function memoryHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function resolveMemoryMarkdownPath(root: string, path: string, mustExist = true) {
  const resolvedRoot = resolve(root);
  const absolutePath = resolve(resolvedRoot, path);
  if (!absolutePath.startsWith(`${resolvedRoot}${sep}`) || extname(absolutePath).toLowerCase() !== ".md") throw new MemoryPathError();

  if (mustExist) {
    if (!existsSync(absolutePath) || !lstatSync(absolutePath).isFile()) throw new MemoryPathError("The requested memory file does not exist.");
    const realRoot = realpathSync(resolvedRoot);
    const realPath = realpathSync(absolutePath);
    if (!realPath.startsWith(`${realRoot}${sep}`)) throw new MemoryPathError();
    return realPath;
  }

  let parent = dirname(absolutePath);
  while (!existsSync(parent)) parent = dirname(parent);
  const realRoot = realpathSync(resolvedRoot);
  const realParent = realpathSync(parent);
  if (realParent !== realRoot && !realParent.startsWith(`${realRoot}${sep}`)) throw new MemoryPathError();
  return absolutePath;
}

export function atomicMemoryWrite(path: string, content: string, expectedHash?: string) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    const mode = existsSync(path) ? statSync(path).mode : 0o600;
    writeFileSync(temporaryPath, content, { encoding: "utf8", mode });
    if (expectedHash !== undefined && memoryHash(readFileSync(path, "utf8")) !== expectedHash) throw new MemoryConflictError();
    renameSync(temporaryPath, path);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
}

function words(content: string) {
  return content.match(/[\p{L}\p{N}][\p{L}\p{N}_'-]*/gu) ?? [];
}

function analysisWords(content: string) {
  // Absolute paths dominate generated rollout summaries but add little topical signal.
  return words(content.replace(/(?:\/[\p{L}\p{N}.@+_-]+){2,}/gu, " "));
}

function headings(content: string) {
  return content.match(/^#{1,6}\s+.+$/gm) ?? [];
}

function title(content: string, path: string) {
  return content.match(/^#\s+(.+)$/m)?.[1].trim() || basename(path, extname(path));
}

function summary(path: string, absolutePath: string, content: string): MemoryFileSummary {
  const file = statSync(absolutePath);
  const directory = dirname(path);
  return {
    path,
    name: basename(path),
    directory: directory === "." ? "Root" : directory,
    title: title(content, path),
    size: file.size,
    modifiedAt: file.mtimeMs,
    words: words(content).length,
    headings: headings(content).length,
    hash: memoryHash(content),
  };
}

function markdownPaths(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownPaths(root, path);
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md") return [];
    return [relative(root, path)];
  });
}

export function codexMemoryRoot() {
  return process.env.CODEX_MEMORY_DIRECTORY || join(process.env.CODEX_HOME || join(homedir(), ".codex"), "memories");
}

export class MemoryRepository {
  readonly root: string;

  constructor(root = codexMemoryRoot()) {
    this.root = resolve(root);
  }

  catalog(): MemoryCatalog {
    if (!existsSync(this.root)) {
      return { root: this.root, files: [], directories: [], totals: { files: 0, bytes: 0, words: 0, headings: 0 }, topTerms: [] };
    }

    const termCounts = new Map<string, number>();
    const files = markdownPaths(this.root)
      .sort((left, right) => left.localeCompare(right))
      .map((path) => {
        const absolutePath = join(this.root, path);
        const content = readFileSync(absolutePath, "utf8");
        analysisWords(content).forEach((word) => {
          const term = word.toLocaleLowerCase();
          if (term.length < 4 || STOP_WORDS.has(term) || /^\d+$/.test(term)) return;
          termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
        });
        return summary(path, absolutePath, content);
      });

    return {
      root: this.root,
      files,
      directories: [...new Set(files.map((file) => file.directory))].sort(),
      totals: {
        files: files.length,
        bytes: files.reduce((sum, file) => sum + file.size, 0),
        words: files.reduce((sum, file) => sum + file.words, 0),
        headings: files.reduce((sum, file) => sum + file.headings, 0),
      },
      topTerms: [...termCounts.entries()]
        .map(([term, count]) => ({ term, count }))
        .sort((left, right) => right.count - left.count || left.term.localeCompare(right.term))
        .slice(0, 20),
    };
  }

  read(path: string): MemoryDocument {
    const absolutePath = this.resolveMarkdownPath(path);
    const content = readFileSync(absolutePath, "utf8");
    const logicalPath = relative(this.root, resolve(this.root, path));
    return { ...summary(logicalPath, absolutePath, content), content };
  }

  search(query: string): MemorySearchResult[] {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle || !existsSync(this.root)) return [];

    return markdownPaths(this.root)
      .map((path) => {
        const content = readFileSync(join(this.root, path), "utf8");
        const matches = content.split(/\r?\n/).flatMap((line, index) => {
          const normalized = line.toLocaleLowerCase();
          const occurrences = normalized.split(needle).length - 1;
          return occurrences > 0
            ? Array.from({ length: occurrences }, () => ({ line: index + 1, excerpt: line.trim().slice(0, 240) }))
            : [];
        });
        return matches.length > 0
          ? { path, title: title(content, path), matches, matchCount: matches.length }
          : null;
      })
      .filter((result): result is MemorySearchResult => result !== null)
      .sort((left, right) => right.matchCount - left.matchCount || left.path.localeCompare(right.path));
  }

  save(input: { path: string; content: string; expectedHash: string }): MemoryDocument {
    const absolutePath = this.resolveMarkdownPath(input.path);
    const currentContent = readFileSync(absolutePath, "utf8");
    if (memoryHash(currentContent) !== input.expectedHash) throw new MemoryConflictError();
    atomicMemoryWrite(absolutePath, input.content, input.expectedHash);
    return this.read(input.path);
  }

  private resolveMarkdownPath(path: string) {
    return resolveMemoryMarkdownPath(this.root, path);
  }
}
