/**
 * @monbolc/lowcode-designer — minimal tree-walk helpers (Phase B)
 *
 * Sapu's slim equivalent of ali's `@alilc/lowcode-utils` helpers
 * that the clickable/path/parse-metadata ports depend on.
 * Kept tiny (no MobX, no deps). Ali's versions do more
 * (typed guards, `node.contains` checks); we ship the minimum
 * the Phase B ports need.
 */

export interface TreeNodeLike<T> {
  readonly id?: string;
  readonly parent?: T | null;
  readonly children?: readonly T[];
}

/**
 * Ali-faithful: walk up the parent chain starting from `node`
 * (inclusive) and return the first ancestor (including the
 * start) for which `predicate(ancestor) === true`. Returns
 * `undefined` if no match.
 */
export function getClosestNode<T extends TreeNodeLike<T>>(
  node: T,
  predicate: (n: T) => boolean,
): T | undefined {
  let cur: T | undefined = node;
  while (cur) {
    if (predicate(cur)) return cur;
    cur = cur.parent ?? undefined;
  }
  return undefined;
}
