/**
 * @monbolc/lowcode-workspace — EditorWindow
 *
 * Wraps a `Resource` with a boolean `active` flag and an event bus
 * for `activate` / `deactivate`. The `Workspace` uses windows to
 * track which resource is currently focused.
 *
 * This is the only place "active" lives. A Resource has no notion
 * of being active; the L4 `Skeleton` reads `window.active` (via the
 * `Workspace`) to decide which pane to highlight.
 */

import { Emitter } from '@monbolc/lowcode-utils';

import { Resource } from './resource';

export interface IEditorWindow {
  readonly resource: Resource;
  readonly active: boolean;
  readonly disposed: boolean;
  readonly events: Emitter<WindowEvents>;

  setActive(next: boolean): void;
  getResource(): Resource;
  dispose(): void;
}

export type WindowEvents = {
  /** Fired when `active` flips false → true. */
  activate: { id: string };
  /** Fired when `active` flips true → false. */
  deactivate: { id: string };
  /** Fired on `dispose()`. Listeners should release their refs. */
  disposed: { id: string };
};

export class EditorWindow implements IEditorWindow {
  readonly resource: Resource;
  private _active: boolean;
  private _disposed = false;
  readonly events: Emitter<WindowEvents>;

  constructor(resource: Resource, active = false) {
    this.resource = resource;
    this._active = active;
    this.events = new Emitter<WindowEvents>();
  }

  get active(): boolean {
    return this._active;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  setActive(next: boolean): void {
    if (this._disposed) return;
    if (next === this._active) return;
    this._active = next;
    if (next) {
      this.events.emit('activate', { id: this.resource.id });
    } else {
      this.events.emit('deactivate', { id: this.resource.id });
    }
  }

  getResource(): Resource {
    return this.resource;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.events.emit('disposed', { id: this.resource.id });
    this.events.removeAllListeners();
  }
}
