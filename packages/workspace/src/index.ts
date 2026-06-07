/**
 * @monbolc/lowcode-workspace — barrel
 *
 * Sapu's L5. Three small classes that hold the *handles* a host
 * (L6 shell, L7 engine) needs to drive multiple editing sessions:
 *
 *   - `Resource`      — pure data: { id, title, project, options }
 *   - `EditorWindow`  — wraps a Resource with an `active` flag and
 *                       activate / deactivate events
 *   - `Workspace`     — owns a list of resources, tracks the active
 *                       one, and (optionally) auto-opens the first
 *                       resource as a window on add
 *
 * No React, no UI, no I/O. ~390 lines total. The upstream `Workbench`
 * tab UI is **not** re-implemented — sapu hosts that want multiple
 * open documents mount multiple `<Skeleton>` instances in their own
 * divs; the `Workspace` keeps the data side coordinated.
 */

export { Resource } from './resource';
export type { IResource, ResourceOptions } from './resource';

export { EditorWindow } from './window';
export type { IEditorWindow, WindowEvents } from './window';

export { Workspace } from './workspace';
export type { IWorkspace, WorkspaceEvents } from './workspace';
