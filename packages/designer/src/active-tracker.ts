/**
 * @monbolc/lowcode-designer — ActiveTracker
 *
 * One "active node" per Project. Distinct from `selectedIds`
 * (which is the multi-select-for-canvas-rendering concept):
 * the active node is the single node being acted on by the
 * next command — what ali calls `currentNode` and what a
 * typical IDE calls "the cursor" or "the focused node".
 *
 * Sapu stance: a plain class with an `Emitter`, no MobX, no
 * proxy. The Project owns one instance. Ali's reference is
 * `designer/src/designer/active-tracker.ts` (slimmed from ~85
 * to ~40 LoC by dropping the obx ref + relying on Emitter
 * subscribers).
 *
 * Why a separate class instead of a Project field:
 * - Clear single-responsibility: tracking vs. document vs. dragon.
 * - Ali-faithful: ali extracts this out of `designer.ts` for the
 *   same reason — easier to test in isolation, easier to swap.
 * - The Emitter is a tiny surface that plugins can subscribe
 *   to without knowing about the rest of the Project.
 */

import { Emitter } from '@monbolc/lowcode-utils';

export interface ActiveTrackerEvents extends Record<string, unknown> {
  /** The active node changed. `id` is null when cleared. */
  activeNodeChanged: { id: string | null };
}

export class ActiveTracker {
  readonly events = new Emitter<ActiveTrackerEvents>();
  private _id: string | null = null;

  /**
   * The currently active node id, or null if no node is active.
   * Ali-faithful naming (`currentNode` in ali's terms; we use
   * `activeNodeId` to disambiguate from the Node wrapper).
   */
  get activeNodeId(): string | null {
    return this._id;
  }

  /**
   * Set the active node. Pass null to clear. No-op if the
   * id is the same as the current active node (avoids
   * unnecessary `activeNodeChanged` events). No-op if
   * `validate` is true and the id doesn't exist in the
   * supplied `isValid` predicate.
   *
   * `isValid` is supplied by the Project so the tracker
   * stays decoupled from DocumentModel (single-responsibility:
   * the tracker tracks, the Project knows the schema).
   */
  set(nodeId: string | null, isValid?: (id: string) => boolean): void {
    if (nodeId === this._id) return;
    if (nodeId !== null && isValid && !isValid(nodeId)) return;
    this._id = nodeId;
    this.events.emit('activeNodeChanged', { id: nodeId });
  }

  /**
   * Subscribe to active-node changes. Returns a disposer
   * that removes the listener when called.
   */
  onActiveNodeChange(fn: (id: string | null) => void): () => void {
    const handler: (e: { id: string | null }) => void = ({ id }) => fn(id);
    this.events.on('activeNodeChanged', handler);
    return () => { this.events.off('activeNodeChanged', handler); };
  }
}
