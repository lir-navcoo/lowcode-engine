/**
 * @monbolc/lowcode-designer — clickable helper (Phase B ali-mirror)
 *
 * Ali-faithful port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/utils/clickable.ts`.
 * Walks up the parent chain from a starting node until it finds
 * one that is both `canClick` AND not under a `isLocked` ancestor.
 *
 * Sapu's slim design: the predicate is a user-supplied callback
 * (`isLocked`, `canClick`) so this file doesn't depend on
 * ali's `INode`. Phase C wires it to sapu's `Node.isLocked`
 * + `DocumentModel.canClickNode`. Ali's port depends on
 * `@alilc/lowcode-utils`; we strip that dep.
 */

import { getClosestNode as getAncestor } from '../../utils/tree-walk';
// `getClosestNode` is ali's util; we port the minimal
// "walk up while predicate returns truthy" helper locally.
import type { TreeNodeLike } from '../../utils/tree-walk';

/**
 * Ali-faithful. Returns the closest ancestor of `currentNode`
 * (starting from `currentNode` itself) whose subtree is
 * clickable: `canClick(node, event) === true` AND the node is
 * not under a `isLocked` ancestor.
 *
 * Ali's exact algorithm (simplified from the `for`-loop in
 * `designer/src/builtin-simulator/utils/clickable.ts`):
 *   1. Start at `currentNode`.
 *   2. Compute `canClick(node, event)`. If `false`, walk up to
 *      `node.parent` and retry.
 *   3. Compute `lockedAncestor = walk_ancestors(node).find(isLocked)`.
 *      If `lockedAncestor` exists AND is NOT `node` itself
 *      (i.e. a higher-up ancestor is locked), step up and retry.
 *   4. Otherwise, return `node`.
 *   5. If the chain exhausts, return `undefined`.
 */
export function getClosestClickableNode<TNode extends TreeNodeLike<TNode>>(
  currentNode: TNode | undefined | null,
  canClick: (n: TNode, event: MouseEvent) => boolean,
  isLocked: (n: TNode) => boolean,
  event: MouseEvent,
): TNode | undefined {
  let node: TNode | undefined = currentNode ?? undefined;
  while (node) {
    if (!canClick(node, event)) {
      node = node.parent ?? undefined;
      continue;
    }
    // canClick is true — but a locked node (the current node
    // OR any ANCESTOR) blocks clicks. Walk parents starting
    // from `node` itself (self-included) looking for any
    // locked node.
    let cursor: TNode | undefined = node;
    let blocked = false;
    while (cursor) {
      if (isLocked(cursor)) {
        blocked = true;
        break;
      }
      cursor = cursor.parent ?? undefined;
    }
    if (blocked) {
      node = node.parent ?? undefined;
      continue;
    }
    return node;
  }
  return undefined;
}
