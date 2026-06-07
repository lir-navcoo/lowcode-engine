/**
 * @monbolc/lowcode-workspace — Workspace
 *
 * Owns a list of `Resource`s and tracks the single active
 * `EditorWindow`. Sapu is single-window: there is at most one
 * active window at a time. Hosts that want multiple open
 * documents mount multiple `<Skeleton>` instances in their own
 * divs — each Skeleton is its own Workspace + Project.
 *
 * The Workspace is **not** the rendering layer. It only owns the
 * data. The L4 `Skeleton` subscribes to `windowActivated` to know
 * which resource to render in the canvas; the L6 `engine` subscribes
 * to `pluginRegistered`-like events (different layer).
 */

import { Emitter } from '@monbolc/lowcode-utils';

import { EditorWindow } from './window';
import { Resource } from './resource';

export interface IWorkspace {
  readonly events: Emitter<WorkspaceEvents>;
  /** When true, the first resource added auto-opens its window. */
  readonly autoOpenFirstWindow: boolean;

  getResourceList(): readonly Resource[];
  getActive(): EditorWindow | null;
  setActive(resource: Resource | string): void;
  addResource(resource: Resource): EditorWindow;
  removeResource(resource: Resource | string): void;
  dispose(): void;
}

export type WorkspaceEvents = {
  /** A new resource was added to the workspace. */
  resourceAdded: { id: string; title: string };
  /** A resource was removed. */
  resourceRemoved: { id: string };
  /** Active window changed (payload: the new active id, or null). */
  windowActivated: { id: string | null };
  /** Workspace has been disposed. */
  disposed: Record<string, never>;
};

export class Workspace implements IWorkspace {
  private readonly _resources: Resource[] = [];
  private readonly _windows: EditorWindow[] = [];
  private _active: EditorWindow | null = null;
  private _disposed = false;

  readonly events: Emitter<WorkspaceEvents>;
  readonly autoOpenFirstWindow: boolean;

  constructor(opts: { autoOpenFirstWindow?: boolean } = {}) {
    this.events = new Emitter<WorkspaceEvents>();
    this.autoOpenFirstWindow = opts.autoOpenFirstWindow ?? true;
  }

  getResourceList(): readonly Resource[] {
    // Return a frozen view; mutating the underlying array is not
    // exposed. Consumers iterate.
    return Object.freeze([...this._resources]);
  }

  getActive(): EditorWindow | null {
    return this._active;
  }

  setActive(target: Resource | string): void {
    if (this._disposed) return;
    const id = typeof target === 'string' ? target : target.id;
    const win = this._windows.find((w) => w.resource.id === id);
    if (!win) {
      // Setting active on an unknown resource is a no-op; not an
      // error — callers can be optimistic and the workspace
      // silently ignores.
      return;
    }
    if (this._active && this._active !== win) {
      this._active.setActive(false);
    }
    win.setActive(true);
    this._active = win;
    this.events.emit('windowActivated', { id: win.resource.id });
  }

  addResource(resource: Resource): EditorWindow {
    if (this._disposed) {
      throw new Error('[workspace] Cannot addResource() on a disposed workspace.');
    }
    if (this._resources.some((r) => r.id === resource.id)) {
      throw new Error(
        `[workspace] Resource id "${resource.id}" already present.`,
      );
    }
    this._resources.push(resource);
    const win = new EditorWindow(resource, false);
    this._windows.push(win);
    this.events.emit('resourceAdded', { id: resource.id, title: resource.title });

    if (this.autoOpenFirstWindow && this._active === null) {
      // Mirror the upstream `enableAutoOpenFirstWindow` default: the
      // very first resource added becomes active without an explicit
      // `setActive()` call from the host.
      win.setActive(true);
      this._active = win;
      this.events.emit('windowActivated', { id: win.resource.id });
    }
    return win;
  }

  removeResource(target: Resource | string): void {
    if (this._disposed) return;
    const id = typeof target === 'string' ? target : target.id;
    const rIdx = this._resources.findIndex((r) => r.id === id);
    if (rIdx < 0) return;
    const wIdx = this._windows.findIndex((w) => w.resource.id === id);
    if (wIdx < 0) return;

    const wasActive = this._active?.resource.id === id;
    this._windows[wIdx].dispose();
    this._windows.splice(wIdx, 1);
    this._resources.splice(rIdx, 1);

    if (wasActive) {
      this._active = null;
      // Auto-promote the next resource if any. Matches upstream
      // behavior — closing the focused window hands focus to the
      // next available one.
      if (this._windows.length > 0) {
        const next = this._windows[0];
        next.setActive(true);
        this._active = next;
        this.events.emit('windowActivated', { id: next.resource.id });
      } else {
        this.events.emit('windowActivated', { id: null });
      }
    }

    this.events.emit('resourceRemoved', { id });
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    for (const w of this._windows) w.dispose();
    this._windows.length = 0;
    this._resources.length = 0;
    this._active = null;
    this.events.emit('disposed', {});
    this.events.removeAllListeners();
  }
}
