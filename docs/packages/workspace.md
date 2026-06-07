# `@monbolc/lowcode-workspace` (L5)

> **Version**: 2.1.2 · **React-free** · **24 tests / 3 files** · **~280 lines** (vs upstream 1,298)
>
> Single-window stance: **multi-document is multi-mount of `<Skeleton>`**, not an in-tree tab bar. Locked 2026-06-07.

## Purpose

A thin types-and-classes layer that lets a host (L6 shell, L7 engine) hold *handles* to multiple editing sessions and track which one is active. The actual rendering is the host's job — `Workspace` is data, not UI.

Three classes:

- `Resource` — pure data wrapper: `{ id, title, project, options }`
- `EditorWindow` — wraps a `Resource` with an `active` flag and `activate` / `deactivate` / `disposed` events
- `Workspace` — owns a list of `Resource`s, tracks the single active `EditorWindow`, optionally auto-opens the first one

No React, no DOM, no I/O. The `Workbench` tab UI is **not** re-implemented.

## Public exports

```ts
class Resource {
  constructor(args: {
    id: string;
    title: string;
    project: Project;
    options?: Readonly<Record<string, unknown>>;
  });
  readonly id: string;
  readonly title: string;
  readonly project: Project;
  readonly options: Readonly<Record<string, unknown>>;
  readonly disposed: boolean;
  dispose(): void;
}
interface IResource { /* readonly shape */ }
type ResourceOptions = Readonly<Record<string, unknown>>;

class EditorWindow {
  constructor(resource: IResource, active?: boolean);
  readonly resource: IResource;
  readonly active: boolean;
  readonly disposed: boolean;
  readonly events: Emitter<WindowEvents>;
  setActive(next: boolean): void;
  getResource(): IResource;
  dispose(): void;
}
interface IEditorWindow { /* readonly shape */ }
type WindowEvents = {
  activate:   { id: string };
  deactivate: { id: string };
  disposed:   { id: string };
};

class Workspace {
  constructor(opts?: { autoOpenFirstWindow?: boolean });
  readonly events: Emitter<WorkspaceEvents>;
  readonly autoOpenFirstWindow: boolean;
  getResourceList(): readonly IResource[];
  getActive(): IEditorWindow | null;
  setActive(resource: IResource | string): void;
  addResource(resource: IResource): IEditorWindow;
  removeResource(resource: IResource | string): void;
  dispose(): void;
}
interface IWorkspace { /* readonly shape */ }
type WorkspaceEvents = {
  resourceAdded:    { id: string; title: string };
  resourceRemoved:  { id: string };
  windowActivated:  { id: string | null };
  disposed:         Record<string, never>;
};
```

## Design decisions

1. **Single-window only.** `Workspace.addResource()` may be called N times, but at any moment at most one `EditorWindow` is `active`. The host mounts a separate `<Skeleton>` per active resource.
2. **No `Workbench` tab UI.** Moved to a future optional `plugin-workbench` (only built if a host asks for it). For sapu, "open another doc" means mount another `<Skeleton>`.
3. **No `ResourceType` registry.** `Resource` is just a `{ id, title, project, options }` bag. The type system upstream uses to differentiate "page" vs "component" vs "snippet" is collapsed to `options.type?: string` if a host cares.
4. **No cross-window drag/drop.** Each `EditorWindow` is isolated. Drag between windows is the host's problem.
5. **Typed `Emitter`, not strings.** Event payloads are typed at the subscribe call site (`window.events.on('activate', (e) => ...)`), and the `Emitter` class enforces payload type at compile time.
6. **Auto-open first window.** Mirrors upstream's `enableAutoOpenFirstWindow: true` default. The first resource added via `addResource(r)` becomes active without a separate `setActive(r)` call. To opt out, pass `autoOpenFirstWindow: false`.
7. **Auto-promote on remove.** Removing the currently active resource auto-activates the next one in the list (or fires `windowActivated: { id: null }` if none remain).

## Slimming rationale

Upstream `packages/workspace/` is 1,298 lines across 13 files. Sapu: ~280 lines, 3 source files + 3 test files. The cuts:

| Dropped from upstream | Why sapu doesn't need it |
|---|---|
| `Workbench` tabbed UI (`editor-skeleton/layouts/workbench.tsx`, ~500 lines) | Replaced by multi-mount of `<Skeleton>` |
| `resourceList` panel UI + drag-and-drop reorder (~250 lines) | Multi-mount gives the user as many reorderable panes as they want |
| `IPublicApiWorkspace` proxy + `setAsInstance` / `current` glue (~150 lines) | L6 will fetch the real class via `import { Workspace } from '@monbolc/lowcode-workspace'` |
| `ResourceType` registry + `getResourceType` lookup (~100 lines) | Hosts put `options.type` as a string |
| `EditorWindow` queue with auto-focus tracking (~80 lines) | Single-window: no queue, just an active flag |
| `setAsInstance` deprecation layer (L6 in upstream) | Sapu L6 will not deprecate anything in L5 |

## Implementation patterns

- Pure TS classes; no React, no DOM. Events via the L1 `Emitter<...>` (typed pub/sub).
- `Resource` is just a data wrapper — the only "behavior" is `dispose()` (idempotent, sets a flag, no L3 mutation).
- `EditorWindow` is a thin `Emitter` wrapper. `setActive()` is the only mutator; it's idempotent and a no-op after `dispose()`.
- `Workspace.addResource(r)` returns the new `EditorWindow`. `setActive()` accepts either an `IResource` or a `string` id (id is the typical call site; passing the resource object is just DX sugar).
- `Workspace.dispose()` releases all windows, fires `disposed`, then `removeAllListeners()` so a stale subscriber doesn't keep the bus alive.
- `Workspace.events` is the only public observable. `EditorWindow.events` is also public (a host can subscribe to per-window transitions if it wants finer-grained events than the workspace-level `windowActivated`).

## Tests

24 tests / 3 files, all green:

- `tests/resource.test.ts` — **5 tests**: store id/title/project/options, default options = empty frozen, getProject(), dispose idempotent, defensive copy of options.
- `tests/window.test.ts` — **7 tests**: default inactive, constructor `active` arg honored, `activate` fires on false→true only, `deactivate` fires on true→false, `setActive` after dispose is no-op, `getResource()`, `dispose` fires once + clears listeners.
- `tests/workspace.test.ts` — **12 tests**: starts empty, `addResource` fires event, auto-open first window, no auto-open when flag off, `setActive` switches + fires event, unknown id is no-op, `removeResource` fires event, removing active promotes next, removing only active fires `windowActivated: null`, duplicate id throws, `getResourceList` is immutable, `dispose` clears all + fires event + blocks further adds.

## Dependencies

- `@monbolc/lowcode-designer` — for `Project` (held by `Resource`)
- `@monbolc/lowcode-types` — re-exported types (none currently consumed directly)
- `@monbolc/lowcode-utils` — for the typed `Emitter`

**No new third-party deps.** No React, no UI. The package is pure data.

## Build

Standard `@monbolc/*` package layout: `tsc -p tsconfig.json` (CJS) + `tsc -p tsconfig.esm.json` (ESM) via the existing `scripts/add-js-extensions.mjs` post-step. No CSS, no Tailwind.

## Why L5 is small

A host that needs two open pages **mounts two `<Skeleton>`s**. The cost of multi-window state machinery (resource queue, activation tracking, cross-window event propagation, tabbed Workbench UI) is high — and the benefit, for a code-first engine whose target user is a developer, is low. A developer can `window.open()` or render two divs. The Workbench was upstream's answer to "open multiple docs in one browser tab" — sapu considers that a host-app concern, not a framework concern.

## Demo proof

`examples/demo/` "Open second doc" button:
- Constructs a second `Project` + `Resource` + `Workspace` (default `autoOpenFirstWindow: true`)
- Mounts a second `<Skeleton>` in a sibling div (`#skeleton-2`)
- Both `<Skeleton>`s share the same `components` registry
- Clicking a node in one outline does **not** affect the other (independent `Project`s)
- The two canvases render side by side, demonstrating that L5's "single window" is per-mount, not per-app

## Future: L5→L6 handoff

When L6 lands, the `Workspace` is one of the things the `SapuEngine` exposes to plugins:

```ts
// L6 SapuEngine (planned)
interface IPluginContext {
  workspace: IWorkspace;     // L5
  project: Project;          // L3
  registerPlugin: (p: IPlugin) => void;
  // ...
}
```

Plugins that need to know "which resource is active?" listen to `workspace.events.on('windowActivated', ...)`. Plugins that need to mutate the active document go through `workspace.getActive()?.resource.project`.
