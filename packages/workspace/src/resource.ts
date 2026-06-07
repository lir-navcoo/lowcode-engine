/**
 * @monbolc/lowcode-workspace — Resource
 *
 * A `Resource` is pure data describing one document the workspace
 * knows about: an `id`, a `title`, a `Project` (the L3 editing
 * model), and an `options` bag for host-specific metadata.
 *
 * Resources don't open, don't render, don't know about windows.
 * They're a *handle*. The `Workspace` (L5) is what decides which
 * `Resource` is "active"; the `EditorWindow` (L5) is what wraps
 * a `Resource` with active-flag + events.
 *
 * The `dispose()` method is a soft-release — it clears references
 * and marks the resource as disposed, but does not call into
 * `Project` (the host decides lifecycle).
 */

import type { Project } from '@monbolc/lowcode-designer';

/** Free-form per-resource metadata. Hosts can stash anything. */
export type ResourceOptions = Readonly<Record<string, unknown>>;

export interface IResource {
  readonly id: string;
  readonly title: string;
  readonly project: Project;
  readonly options: ResourceOptions;

  /** True after `dispose()` has been called. */
  readonly disposed: boolean;

  dispose(): void;
}

export class Resource implements IResource {
  readonly id: string;
  readonly title: string;
  readonly project: Project;
  readonly options: ResourceOptions;
  private _disposed = false;

  constructor(args: {
    id: string;
    title: string;
    project: Project;
    options?: ResourceOptions;
  }) {
    this.id = args.id;
    this.title = args.title;
    this.project = args.project;
    // Defensive copy so a later mutation of the caller's object
    // can't silently change the resource.
    this.options = Object.freeze({ ...(args.options ?? {}) });
  }

  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Mark the resource as disposed and drop references. Idempotent
   * — calling it twice is a no-op. After dispose, `getProject()`
   * would still return the original Project reference (we don't
   * force the L3 layer to clean up), but consumers should treat
   * the resource as gone.
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    // Nothing else to clear — Project / options are read-only refs.
  }
}
