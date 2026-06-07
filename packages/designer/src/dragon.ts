/**
 * @monbolc/lowcode-designer — Dragon
 *
 * Drag state machine. Tracks:
 *   - which node is being dragged
 *   - current pointer position
 *   - current drop target (parent node + insertion index)
 *
 * The host wires pointer events on the canvas and calls
 * `dragon.move(x, y)` and `dragon.drop()` as appropriate.
 *
 * For the L3 milestone this is a self-contained state machine.
 * Visual feedback (ghost, insertion indicator) is rendered by the
 * Skeleton layer (L4+).
 */

import { Emitter } from '@monbolc/lowcode-utils';

export interface DragonState {
  /** id of the node being dragged, or null. */
  draggingNodeId: string | null;
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

export interface DragonEvents extends Record<string, unknown> {
  /** A drag just started. */
  start: { nodeId: string };
  /** Pointer moved during a drag. */
  move: { x: number; y: number; dropTarget: DropTarget | null };
  /** A drag ended without a successful drop. */
  cancel: { nodeId: string };
  /** A drag ended with a successful drop. */
  drop: { nodeId: string; target: DropTarget };
}

export class Dragon {
  readonly events = new Emitter<DragonEvents>();
  private _state: DragonState = { draggingNodeId: null, x: 0, y: 0, dropTarget: null };

  get state(): DragonState {
    return this._state;
  }

  get isDragging(): boolean {
    return this._state.draggingNodeId !== null;
  }

  start(nodeId: string, x: number, y: number): void {
    if (this._state.draggingNodeId) return;
    this._state = { draggingNodeId: nodeId, x, y, dropTarget: null };
    this.events.emit('start', { nodeId });
  }

  move(x: number, y: number, dropTarget: DropTarget | null = null): void {
    if (!this._state.draggingNodeId) return;
    this._state = { ...this._state, x, y, dropTarget };
    this.events.emit('move', { x, y, dropTarget });
  }

  /** Mark the drag as successful; emits a `drop` event with the
   * current drop target. The host should commit the actual mutation
   * (e.g. via Project.document.move) on receipt. */
  commit(): { nodeId: string; target: DropTarget } | null {
    const id = this._state.draggingNodeId;
    const target = this._state.dropTarget;
    if (!id) return null;
    this._state = { draggingNodeId: null, x: 0, y: 0, dropTarget: null };
    if (target) {
      this.events.emit('drop', { nodeId: id, target });
    } else {
      this.events.emit('cancel', { nodeId: id });
    }
    return target ? { nodeId: id, target } : null;
  }

  /** Cancel an in-progress drag (e.g. on Escape). */
  cancel(): void {
    const id = this._state.draggingNodeId;
    if (!id) return;
    this._state = { draggingNodeId: null, x: 0, y: 0, dropTarget: null };
    this.events.emit('cancel', { nodeId: id });
  }
}
