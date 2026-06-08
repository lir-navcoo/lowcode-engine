/**
 * @monbolc/lowcode-designer — Dragon
 *
 * Drag state machine. Tracks:
 *   - which existing node is being dragged (move), OR
 *   - which component meta is being dragged from a palette (boost)
 *   - current pointer position
 *   - current drop target (parent node + insertion index)
 *
 * The host wires pointer events on the canvas and calls
 * `dragon.move(x, y)` and `dragon.commit()` as appropriate.
 *
 * For the L3 milestone this is a self-contained state machine.
 * Visual feedback (ghost, insertion indicator) is rendered by the
 * Skeleton layer (L4+).
 */

import { Emitter } from '@monbolc/lowcode-utils';
import type { JSONValue } from '@monbolc/lowcode-types';

export interface DragonState {
  /** id of the node being dragged, or null. */
  draggingNodeId: string | null;
  /** Boost payload (the component about to be instantiated on drop), or null. */
  boost: BoostMeta | null;
  /** Current pointer x in viewport coords. */
  x: number;
  /** Current pointer y in viewport coords. */
  y: number;
  /** Computed drop target, or null if no valid target under the pointer. */
  dropTarget: DropTarget | null;
}

export interface DropTarget {
  /** id of the parent node that would receive the drop, or null for root. */
  parentId: string | null;
  /** Index in the parent's children array where the drop would land. */
  index: number;
  /** Whether the drop would go inside the target (vs before/after). */
  placement: 'before' | 'after' | 'inside';
}

/**
 * Payload for a "boost" — a drag that hasn't started from an existing
 * node. The component is created from `componentName` (+ optional
 * `initialProps`) on a successful drop.
 */
export interface BoostMeta {
  componentName: string;
  initialProps?: Record<string, JSONValue>;
}

export interface DragonEvents extends Record<string, unknown> {
  /** A drag of an existing node just started. */
  start: { nodeId: string };
  /** A boost (palette → canvas) drag just started. */
  startBoost: { meta: BoostMeta };
  /** Pointer moved during a drag. */
  move: { x: number; y: number; dropTarget: DropTarget | null };
  /** A drag ended without a successful drop. */
  cancel: { nodeId: string };
  /** A boost drag ended without a successful drop. */
  cancelBoost: { meta: BoostMeta };
  /** A drag of an existing node ended with a successful drop. */
  drop: { nodeId: string; target: DropTarget };
  /** A boost drag ended with a successful drop. */
  dropBoost: { meta: BoostMeta; target: DropTarget };
}

export class Dragon {
  readonly events = new Emitter<DragonEvents>();
  private _state: DragonState = { draggingNodeId: null, boost: null, x: 0, y: 0, dropTarget: null };

  get state(): DragonState {
    return this._state;
  }

  get isDragging(): boolean {
    return this._state.draggingNodeId !== null || this._state.boost !== null;
  }

  /** True iff a boost (palette → canvas) drag is in progress. */
  get isBoosting(): boolean {
    return this._state.boost !== null;
  }

  start(nodeId: string, x: number, y: number): void {
    if (this._state.draggingNodeId || this._state.boost) return;
    this._state = { draggingNodeId: nodeId, boost: null, x, y, dropTarget: null };
    this.events.emit('start', { nodeId });
  }

  /**
   * Start a "boost" drag — the user is dragging a not-yet-instantiated
   * component out of a palette. On a successful `commit()`, the host
   * should create a new schema node from `meta.componentName` at the
   * drop target.
   */
  boost(meta: BoostMeta, x: number, y: number): void {
    if (this._state.draggingNodeId || this._state.boost) return;
    this._state = { draggingNodeId: null, boost: meta, x, y, dropTarget: null };
    this.events.emit('startBoost', { meta });
  }

  move(x: number, y: number, dropTarget: DropTarget | null = null): void {
    if (!this._state.draggingNodeId && !this._state.boost) return;
    this._state = { ...this._state, x, y, dropTarget };
    this.events.emit('move', { x, y, dropTarget });
  }

  /**
   * Mark the drag as successful; emits a `drop` (existing-node move)
   * or `dropBoost` (palette → canvas) event with the current target.
   * The host should commit the actual mutation on receipt.
   *
   * Returns a discriminated union so the caller can dispatch on
   * `'nodeId' in result` vs `'meta' in result`.
   */
  commit():
    | { kind: 'move'; nodeId: string; target: DropTarget }
    | { kind: 'boost'; meta: BoostMeta; target: DropTarget }
    | null {
    const { draggingNodeId, boost, dropTarget } = this._state;
    if (!draggingNodeId && !boost) return null;
    this._state = { draggingNodeId: null, boost: null, x: 0, y: 0, dropTarget: null };
    if (dropTarget) {
      if (boost) {
        this.events.emit('dropBoost', { meta: boost, target: dropTarget });
        return { kind: 'boost', meta: boost, target: dropTarget };
      }
      this.events.emit('drop', { nodeId: draggingNodeId!, target: dropTarget });
      return { kind: 'move', nodeId: draggingNodeId!, target: dropTarget };
    }
    if (boost) {
      this.events.emit('cancelBoost', { meta: boost });
    } else {
      this.events.emit('cancel', { nodeId: draggingNodeId! });
    }
    return null;
  }

  /** Cancel an in-progress drag (e.g. on Escape). */
  cancel(): void {
    const { draggingNodeId, boost } = this._state;
    if (!draggingNodeId && !boost) return;
    this._state = { draggingNodeId: null, boost: null, x: 0, y: 0, dropTarget: null };
    if (boost) {
      this.events.emit('cancelBoost', { meta: boost });
    } else {
      this.events.emit('cancel', { nodeId: draggingNodeId! });
    }
  }
}
