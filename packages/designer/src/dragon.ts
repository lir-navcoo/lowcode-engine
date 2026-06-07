/**
 * @monbolc/lowcode-designer — Dragon
 *
 * Drag state machine. The Dragon is the single source of truth for
 * "is the user currently dragging something?", and provides the
 * hooks (onDragStart / onDrag / onDragEnd) for components that
 * need to react.
 *
 * For the L3 milestone this is a minimal implementation: it tracks
 * a single node id being dragged, plus a current pointer position,
 * and emits events. The designer-host (in a later layer) will
 * render the ghost and decide where to drop.
 */

import { Emitter } from '@monbolc/lowcode-utils';

export interface DragonState {
  /** id of the node being dragged, or null. */
  draggingNodeId: string | null;
  /** Current pointer x in viewport coords. */
  x: number;
  /** Current pointer y in viewport coords. */
  y: number;
}

export interface DragonEvents extends Record<string, unknown> {
  /** A drag just started. */
  start: { nodeId: string };
  /** Pointer moved during a drag. */
  move: { x: number; y: number };
  /** A drag ended (committed, cancelled, or otherwise finished). */
  end: { nodeId: string; committed: boolean };
}

export class Dragon {
  readonly events = new Emitter<DragonEvents>();
  private _state: DragonState = { draggingNodeId: null, x: 0, y: 0 };

  get state(): DragonState {
    return this._state;
  }

  get isDragging(): boolean {
    return this._state.draggingNodeId !== null;
  }

  start(nodeId: string, x: number, y: number): void {
    if (this._state.draggingNodeId) return; // ignore while another drag is in progress
    this._state = { draggingNodeId: nodeId, x, y };
    this.events.emit('start', { nodeId });
  }

  move(x: number, y: number): void {
    if (!this._state.draggingNodeId) return;
    this._state = { ...this._state, x, y };
    this.events.emit('move', { x, y });
  }

  end(committed: boolean): void {
    const id = this._state.draggingNodeId;
    if (!id) return;
    this._state = { draggingNodeId: null, x: 0, y: 0 };
    this.events.emit('end', { nodeId: id, committed });
  }
}
