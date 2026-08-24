export type ThreadSession = {
  id: string;
  path: string;
  parentThreadId: string;
  startedAt: number;
};

export type FilterableThreadSession = ThreadSession & {
  project: string;
  provenance: string;
};

export type SessionTreeFilters = {
  project?: string;
  month?: string;
  provenance?: string;
  contentPaths?: ReadonlySet<string>;
};

export type SessionTreeNode<T extends ThreadSession> = {
  session: T;
  children: SessionTreeNode<T>[];
  orphan: boolean;
  cycle: boolean;
  contextOnly: boolean;
};

function newestFirst<T extends ThreadSession>(left: T, right: T) {
  return right.startedAt - left.startedAt || left.id.localeCompare(right.id);
}

export function matchingSessionPaths<T extends FilterableThreadSession>(sessions: T[], filters: SessionTreeFilters) {
  return new Set(sessions
    .filter((session) => !filters.project || session.project === filters.project)
    .filter((session) => !filters.month || new Date(session.startedAt).toISOString().startsWith(filters.month))
    .filter((session) => !filters.provenance || session.provenance === filters.provenance)
    .filter((session) => !filters.contentPaths || filters.contentPaths.has(session.path))
    .map((session) => session.path));
}

export function buildSessionForest<T extends ThreadSession>(sessions: T[], matchingPaths?: ReadonlySet<string>): SessionTreeNode<T>[] {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const children = new Map<string, T[]>();
  sessions.forEach((session) => {
    if (!session.parentThreadId || !byId.has(session.parentThreadId)) return;
    const siblings = children.get(session.parentThreadId) ?? [];
    siblings.push(session);
    children.set(session.parentThreadId, siblings);
  });
  const visited = new Set<string>();
  const node = (session: T, cycle = false): SessionTreeNode<T> => {
    visited.add(session.path);
    return {
      session,
      children: (children.get(session.id) ?? [])
        .filter((child) => !visited.has(child.path))
        .sort(newestFirst)
        .map((child) => node(child)),
      orphan: Boolean(session.parentThreadId && !byId.has(session.parentThreadId)),
      cycle,
      contextOnly: false,
    };
  };
  const forest = sessions
    .filter((session) => !session.parentThreadId || !byId.has(session.parentThreadId))
    .sort(newestFirst)
    .map((session) => node(session));
  sessions
    .filter((session) => !visited.has(session.path))
    .sort(newestFirst)
    .forEach((session) => {
      if (!visited.has(session.path)) forest.push(node(session, true));
    });
  if (!matchingPaths) return forest;
  const prune = (treeNode: SessionTreeNode<T>): SessionTreeNode<T> | null => {
    const retainedChildren = treeNode.children.map(prune).filter((child): child is SessionTreeNode<T> => child !== null);
    const directMatch = matchingPaths.has(treeNode.session.path);
    if (!directMatch && retainedChildren.length === 0) return null;
    return { ...treeNode, children: retainedChildren, contextOnly: !directMatch };
  };
  return forest.map(prune).filter((treeNode): treeNode is SessionTreeNode<T> => treeNode !== null);
}
