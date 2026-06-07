# `@monbolc/lowcode-workspace` (L5) — PLANNED

> **Version**: not yet published · **React-free** · **~390 lines** (vs upstream's 1,298)
>
> **Status**: see `docs/ROADMAP.md` → P3 → L5. The decision is locked 2026-06-07: single-window only; multi-document is multi-mount of `<Skeleton>`.

## Purpose

Sapu's L5 is a thin types-and-classes layer that gives plugin code from upstream a familiar shape (`Workspace`, `EditorWindow`, `Resource`) so ali-port plugin code type-checks. It does **not** carry the multi-window Workbench UI; the Workbench is replaced by "mount another `<Skeleton>`".

## Public exports (planned)

```ts
// Pure data + lifecycle — no React, no DOM
class Resource {
  constructor(opts: { id: string; title: string; project: Project; options?: object });
  getId(): string;
  getTitle(): string;
  getProject(): Project;
  dispose(): void;
}
interface IResource { /* same shape, readonly */ }

class EditorWindow {
  constructor(resource: IResource);
  getResource(): IResource;
  setActive(active: boolean): void;
  isActive(): boolean;
  on(event: 'activate' | 'deactivate', fn: () => void): () => void;
  dispose(): void;
}
interface IEditorWindow { /* same shape */ }

class Workspace {
  constructor(opts?: { enableAutoOpenFirstWindow?: boolean });
  addResource(resource: IResource): IEditorWindow;
  removeResource(resource: IResource): void;
  getResourceList(): readonly IResource[];
  getActive(): IEditorWindow | undefined;
  setActive(resource: IResource): void;
  on(event: 'change_active' | 'resource_added' | 'resource_removed', fn: (r: IResource) => void): () => void;
  dispose(): void;
}
interface IWorkspace { /* same shape */ }
```

## Design decisions

1. **Single-window only** — `Workspace.addResource()` may be called N times but at any moment only one `EditorWindow` is "active". The host mounts a separate `<Skeleton>` per active resource.
2. **No `Workbench` tab UI** — moved to a future optional `plugin-workbench` (only built if a host asks for it).
3. **No `ResourceType` registry** — `Resource` is just a `{ id, title, project, options }` bag. The type system upstream uses to differentiate "page" vs "component" vs "snippet" resources is collapsed to a `type?: string` field on `Resource.options`.
4. **No cross-window drag/drop** — each `EditorWindow` is isolated. Drag between windows is the host's problem.

## Slimming rationale

Upstream `packages/workspace/src/workspace.ts` is 379 lines. Of those, ~120 are `resourceList` management + `ResourceType` registry, ~80 are `EditorWindow` queue + `setActive` machinery, ~60 are `emitChangeActiveEditorView` event plumbing, and the rest is `IPublicApiWorkspace` proxy glue for the L6 shell. Sapu drops the L6 proxy glue (L6 will fetch the real class) and collapses the `ResourceType` registry to a `string` field. Net: ~120 lines for `Workspace`.

## Implementation patterns (when built)

- Pure TS classes; no React, no DOM. Emits events via the same `createModuleEventBus` pattern used in `editor-core`.
- `IProject` and `IPublicType*` are the only types from `@monbolc/*` it imports.
- `Workspace` holds an internal `Map<string, IEditorWindow>` (resource id → window).
- `enableAutoOpenFirstWindow: true` → after `addResource(r)`, immediately call `setActive(r)`.

## Tests (planned)

- `tests/resource.test.ts` — 3 tests: construct, getters, dispose is idempotent.
- `tests/window.test.ts` — 4 tests: construct, setActive fires events, getResource, dispose.
- `tests/workspace.test.ts` — 6 tests: addResource, removeResource, setActive, getActive, getResourceList immutability, enableAutoOpenFirstWindow.

Total: 13 tests, ~250 lines.

## Dependencies

- `@monbolc/lowcode-types` — for `IPublicTypeDisposable`
- `@monbolc/lowcode-designer` — for `Project` (passed into `Resource`)

No new third-party deps. Permission-gate: any future dep addition must be confirmed.

## Build

Standard `@monbolc/*` package layout: `tsc -p tsconfig.json` (CJS) + `tsc -p tsconfig.esm.json` (ESM) via the existing `scripts/add-js-extensions.mjs` post-step. No CSS, no Tailwind.

## Why L5 is small

A host that needs two open pages **mounts two Skeletons**. The cost of multi-window state machinery (resource queue, activation tracking, cross-window event propagation, tabbed Workbench UI) is high — and the benefit, for a code-first engine whose target user is a developer, is low. A developer can `window.open()` or render two divs. The Workbench was upstream's answer to "open multiple docs in one browser tab" — sapu considers that a host-app concern, not a framework concern.
