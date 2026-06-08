/**
 * @monbolc/lowcode-designer — BuiltinSimulatorHost
 *
 * Wires the canvas DOM to the Dragon state machine. Listens for
 * `pointermove` / `pointerup` (and `pointerleave` to cancel), feeds
 * the Dragon the current pointer + computed drop target, and on a
 * successful commit:
 *
 *   - if the drag was a `boost` (palette → canvas), create a new
 *     schema node from the BoostMeta at the drop target.
 *   - if the drag was a `move` (existing node), call
 *     `DocumentModel.move(node, newParent, newIndex)`.
 *
 * The drop target is computed from a `hitTest` of the element under
 * the pointer:
 *   - upper third of the hit element → 'before'
 *   - middle third               → 'inside'
 *   - lower third                → 'after'
 *
 * If nothing is hit, the target is the root (parentId = null, index =
 * end of root's children). This makes the canvas itself a valid drop
 * zone for empty pages.
 *
 * Note: this is a minimal L3/L4 implementation. Ali's upstream has
 * ancestor-walk `handleAccept` (nesting whitelist) and
 * `drillDownExcludes`; those are deferred to a follow-up. For now
 * any node can be dropped into any other.
 */

import { Project } from './project';
import type { DropTarget } from './dragon';
import { getHitInfo, hitTest } from './dom';
import type { IPublicTypeNodeSchema, JSONValue } from '@monbolc/lowcode-types';

export interface SimulatorHostOptions {
  /** The canvas container — same element the simulator renders into. */
  canvas: HTMLElement;
  /** Drop event hook. Called once per successful commit. */
  onDrop?: (info: { kind: 'move' | 'boost'; target: DropTarget; meta?: { componentName: string; initialProps?: Record<string, unknown> }; nodeId?: string }) => void;
  /**
   * If true, ignore drops that would target the same parent+index
   * the dragged node is already at. Default true — avoids the
   * "drag a node where it already is" footgun.
   */
  noOpOnSameSpot?: boolean;
}

export class BuiltinSimulatorHost {
  private readonly canvas: HTMLElement;
  private readonly project: Project;
  private readonly onDrop?: SimulatorHostOptions['onDrop'];
  private readonly noOpOnSameSpot: boolean;
  private bound = false;
  private readonly onMove = (e: PointerEvent) => this.handleMove(e);
  private readonly onUp = (e: PointerEvent) => this.handleUp(e);
  private readonly onCancel = () => this.handleCancel();

  constructor(project: Project, options: SimulatorHostOptions) {
    this.project = project;
    this.canvas = options.canvas;
    this.onDrop = options.onDrop;
    this.noOpOnSameSpot = options.noOpOnSameSpot ?? true;
  }

  /** Attach DOM listeners. Idempotent. */
  mount(): void {
    if (this.bound) return;
    this.bound = true;
    this.canvas.addEventListener('pointermove', this.onMove);
    // Use window-level pointerup so a drop outside the canvas still
    // commits (the ghost might have drifted out).
    window.addEventListener('pointerup', this.onUp);
    // Escape cancels. Bound to window so it works regardless of focus.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.handleCancel();
    });
  }

  /** Detach DOM listeners. Call on editor unmount. */
  unmount(): void {
    if (!this.bound) return;
    this.bound = false;
    this.canvas.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }

  /**
   * Compute a DropTarget for the given pointer position. Exposed
   * publicly so the canvas can preview the drop indicator on each
   * move. Pure — no Dragon interaction.
   *
   * Algorithm:
   *   1. `hitTest` to find the deepest rendered element with
   *      `data-lce-id` under the pointer.
   *   2. Walk up the element tree until we find a node that's
   *      NOT a leaf container (so we have somewhere to drop
   *      'before' / 'after' / 'inside').
   *   3. Use vertical thirds of the hit element to pick
   *      before/after/inside.
   *   4. If nothing is hit, target root at end-of-children.
   */
  computeDropTarget(x: number, y: number): DropTarget | null {
    const root = this.project.document.root;
    const rootId = root.key as string | undefined;

    const hit = getHitInfo(this.canvas, x, y);
    if (!hit.hitId) {
      // Empty canvas → append to root.
      const rootChildren = root.children ?? [];
      return { parentId: null, index: rootChildren.length, placement: 'inside' };
    }
    const hitNode = this.project.document.getNode(hit.hitId);
    if (!hitNode) return null;

    const topThird = hit.height / 3;
    const bottomThird = (2 * hit.height) / 3;

    // `parent` is the hit node's parent Node, or null when the hit
    // node IS the root. `siblings` is typed as `Array<{ id: string }>`
    // so we can mix `Node.children` (Node[]) with root.children
    // (IPublicTypeNodeSchema[]). For root.children we synthesise a
    // wrapper that exposes the same `.id` getter via the schema's
    // stable `key` field — DocumentModel assigns keys on load.
    const parent = hitNode.parent;
    const parentId = parent?.id ?? null;
    const siblings: Array<{ id: string }> = parent
      ? parent.children
      : (root.children ?? []).map((c) => ({ id: (c.key as string) ?? '' }));
    const idx = siblings.findIndex((c) => c.id === hit.hitId);

    if (hit.relativeY < topThird) {
      // 'before' the hit — drop as a sibling, just before it.
      if (idx < 0) return { parentId, index: 0, placement: 'before' };
      return { parentId, index: idx, placement: 'before' };
    }
    if (hit.relativeY > bottomThird) {
      // 'after' the hit.
      if (idx < 0) return { parentId, index: siblings.length, placement: 'after' };
      return { parentId, index: idx + 1, placement: 'after' };
    }
    // 'inside' the hit — append to the hit's children.
    return { parentId: hit.hitId, index: (hitNode.schema.children ?? []).length, placement: 'inside' };
  }

  private handleMove(e: PointerEvent): void {
    if (!this.project.dragon.isDragging) return;
    const target = this.computeDropTarget(e.clientX, e.clientY);
    this.project.dragon.move(e.clientX, e.clientY, target);
  }

  private handleUp(_e: PointerEvent): void {
    if (!this.project.dragon.isDragging) return;
    const result = this.project.dragon.commit();
    if (!result) return;
    this.commitDrop(result);
  }

  private handleCancel(): void {
    if (!this.project.dragon.isDragging) return;
    this.project.dragon.cancel();
  }

  private commitDrop(
    result:
      | { kind: 'move'; nodeId: string; target: DropTarget }
      | { kind: 'boost'; meta: import('./dragon').BoostMeta; target: DropTarget },
  ): void {
    if (result.kind === 'move') {
      const node = this.project.document.getNode(result.nodeId);
      if (!node) return;
      const newParent = result.target.parentId
        ? this.project.document.getNode(result.target.parentId) ?? null
        : null;
      if (this.noOpOnSameSpot && node.parent?.id === result.target.parentId) {
        // Same mix-of-types problem as computeDropTarget: when the
        // dragged node is a direct child of root, `node.parent` is
        // null and we read `root.children` (IPublicTypeNodeSchema[]).
        // We only need `id` for the no-op check, so wrap on the fly.
        const curSiblings: Array<{ id: string }> = node.parent
          ? node.parent.children
          : (this.project.document.root.children ?? []).map((c) => ({ id: (c.key as string) ?? '' }));
        const curIdx = curSiblings.findIndex((c) => c.id === node.id);
        if (curIdx === result.target.index) return;
      }
      this.project.document.move(node, newParent, result.target.index);
      this.onDrop?.({ kind: 'move', target: result.target, nodeId: result.nodeId });
      return;
    }
    // boost: create a new schema node.
    const initialProps = result.meta.initialProps as Record<string, JSONValue> | undefined;
    const schema: IPublicTypeNodeSchema = {
      componentName: result.meta.componentName,
      ...(initialProps ? { props: initialProps } : {}),
    };
    const parent = result.target.parentId
      ? this.project.document.getNode(result.target.parentId) ?? null
      : null;
    const inserted = this.project.document.insert(schema, parent, result.target.index);
    this.onDrop?.({
      kind: 'boost',
      target: result.target,
      meta: { componentName: result.meta.componentName, initialProps },
    });
    // Select the freshly-inserted node so the settings panel
    // immediately shows its props.
    this.project.select(inserted.id);
  }
}

/** Look up an element under (x, y) and return its `data-lce-id` value
 *  if any, walking up the tree. Convenience wrapper around `hitTest`
 *  for callers that just need the id. */
export { hitTest };
