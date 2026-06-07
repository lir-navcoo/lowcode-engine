# Architecture — SapuLowcodeEngine

> Last refreshed: 2026-06-07. Update this file when a new layer is added, a dependency edge changes, or a design principle is amended.

## L0–L7 layering

Sapu is organized as a strict (mostly) bottom-up dependency stack. Each layer can depend on its own layer or below, never above.

| Layer | Purpose | Packages | React-free? |
|---:|---|---|---|
| **L0** | Foundation types + bootstrap | `@monbolc/lowcode-types`, `@monbolc/lowcode-ignitor` | ✅ |
| **L1** | Pure utility functions | `@monbolc/lowcode-utils` | ✅ |
| **L2** | Core editor logic (no React) | `@monbolc/lowcode-editor-core`, `@monbolc/lowcode-plugin-command`, `@monbolc/lowcode-renderer-core`, `@monbolc/lowcode-plugin-outline-pane`* | ✅ / no real React (uses `react-arborist` runtime) |
| **L2.5** | Setters (BaseUI, in progress) | `@monbolc/lowcode-plugin-setters` | ⚠️ types only, setters return vdom-shaped objects |
| **L3** | React integration + design model | `@monbolc/lowcode-react-renderer`, `@monbolc/lowcode-designer` | ⚠️ designer uses adapter; only react-renderer imports React |
| **L4** | Skeleton UI (3-pane editor) | `@monbolc/lowcode-editor-skeleton` | ❌ React + `react-resizable-panels` |
| **L5** | Workspace (single-window) | `@monbolc/lowcode-workspace` *(planned, see ROADMAP L5)* | ✅ (only types — no UI; UI is multi-mount of L4) |
| L6 | (planned) Shell | — | — |
| L7 | (planned) Engine (composition root) | — | — |

\* `plugin-outline-pane` is technically L2-shaped code (depends only on editor-core + renderer-core) but ships a `react-arborist`-backed view. It uses the adapter for `createElement`, not direct React imports.

## Dependency graph (workspace deps only)

```
L0: types
    ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑
L0: ignitor
L1: utils
    ↑   ↑   ↑   ↑   ↑   ↑   ↑   ↑   ↑
L2: plugin-command ─────────┐
L2: editor-core ────────────┤
L2: renderer-core ─────────────────────────────┐
L2: plugin-outline-pane ──┤                    │
                         │                    │
L2.5: plugin-setters     (no inbound deps yet)│
                                                 │
L3: react-renderer ─────────────────────────────┤
L3: designer ─────────────┤                    │
                         │                    │
L4: editor-skeleton ───────────────────────────┘
```

Reverse-direction inbound (who imports whom):
- `types` ← everyone (10 inbound)
- `utils` ← 8 packages
- `renderer-core` ← 4 (outline-pane, react-renderer, designer, editor-skeleton)
- `editor-core` ← 2 (outline-pane, designer)
- `plugin-command` ← 2 (editor-core, designer)
- `react-renderer` ← 2 (designer, editor-skeleton)
- `plugin-outline-pane` ← 1 (editor-skeleton)
- `designer` ← 1 (editor-skeleton)
- `plugin-setters` ← 0 (not yet wired in)
- `ignitor` ← 0 (still a placeholder)

## React injection boundary

This is the **most important architectural decision** in sapu. It is what makes L0–L2 (and parts of L3) immune to React major version changes.

The contract:
- `renderer-core` defines `IRuntime = { Component, PureComponent, createElement, createContext, forwardRef, findDOMNode? }` (all `any`-typed to stay framework-agnostic).
- All renderers access React primitives via `adapter.getRuntime().createElement`, never `import { createElement } from 'react'`.
- The `adapter` is a process-wide singleton; `setRuntime(runtime)` validates that all required modules are present and stores them.
- Only `react-renderer` actually does `import React from 'react'` (and `react-dom/client`). It is the **only** package that "knows" about React.
- `react-renderer.installReactRuntime()` is idempotent: it builds the `IRuntime` object from React 19.2.7 and registers it.

Who uses the `h()()` resolver pattern:
- `react-renderer/renderers.tsx` — the 6 concrete renderer classes (`PageRendererImpl`, `ComponentRendererImpl`, etc.)
- `react-renderer/render.tsx` — `ReactRenderer` (the public factory)
- `designer/simulator.tsx` — `Simulator` (preview mode)
- `plugin-outline-pane/view.tsx` — `OutlineView` component
- `editor-skeleton/skeleton.tsx` — `Skeleton` layout
- `editor-skeleton/overlays.tsx` — `Overlays` (DOM-manipulation based)
- `editor-skeleton/settings-panel.tsx` — `SettingsPanel`

The `h()()` resolver pattern is:
```ts
const h = () => adapter.getRuntime().createElement as CreateElement;
// Used as: h()('div', { id: 'foo' }, [child1, child2])
```
This re-resolves the runtime on every call, so consumers can install the runtime AFTER the module loads (critical for tests).

## Design principles

1. **No MobX**. The L0–L2 layers use a custom `Emitter` class (`utils`) + `useRev` hooks for re-render triggers. Decision (2026-06-07): defer reactivity to L3+ when we actually need it. When the time comes, **Valtio** is the leading candidate (lighter than MobX, no decorator coupling, plays well with React 19's `useSyncExternalStore`).

2. **Adapter pattern for React isolation**. L0–L2 never import React. The `adapter` singleton in `renderer-core` is the seam.

3. **Pure-types for L0 types**. `@monbolc/lowcode-types` has **zero runtime code** — every export is an `interface` or `type`. This means it can never break at runtime and re-publishes are cheap.

4. **Pure functions in L1 utils**. `@monbolc/lowcode-utils` is entirely tree-shakeable functions (except `Emitter` and `ConsoleLogger` classes). No side effects on import.

5. **TypeScript strict mode + no decorators**. Uses `tsconfig` with `strict: true`, no `experimentalDecorators` (which the upstream v1.3.2 ali-lowcode-engine enables for legacy `@observer`/`@inject`).

6. **Function components only**. The repo has **zero** class components (verified across all 11 packages). This is the key difference from the upstream, which has 104 class components.

7. **`h()()` resolver, not `import * as React`**. The 11 React-adjacent files use a `const h = () => adapter.getRuntime().createElement` resolver instead of `import { createElement } from 'react'`. This means they can be re-targeted at Preact, Vue, or any compatible framework by swapping the runtime.

8. **Framework-agnostic setters**. `plugin-setters/built-in.tsx` setters return `{ type, props, children? }` vdom-shaped objects, not JSX elements. The L4 settings panel is responsible for mapping them into the runtime's `createElement`. This is the L2.5 architectural answer to "how do we keep the setter definitions framework-agnostic."

9. **DOM-level overlays, not React-rendered**. `editor-skeleton/overlays.tsx` writes overlay divs directly into `canvasContainer` (the React component returns `null`). This avoids fighting React reconciliation on overlay divs that need to follow the user's mouse cursor.

10. **Inline-styles + injected `<style>` tag**. `editor-skeleton` injects a single `<style>` block once (idempotent via a module-level boolean) with all its CSS, using stable class names like `sapu-skel-*`, `sapu-border-overlay`, `sapu-drag-ghost`, `sapu-insertion-indicator`. This avoids a build step for styles and keeps the package framework-agnostic.

11. **Use React 19 features when applicable** (per `feedback-react19-and-baseui`, 2026-06-07). Don't default to React 16/18 idioms. Specifically:
    - `useSyncExternalStore` is the canonical replacement for the custom `useRev` hook — use it when refactoring `useRev` consumers
    - `useOptimistic` for the `Dragon` (drag preview), `RenameCommand`, `SetPropCommand` slider drag
    - `useActionState` for the `SettingsPanel` input flow
    - `ref` as a prop (no `forwardRef` in new code)
    - Actions (functions on `onClick`)
    - `useTransition` for non-urgent updates (outline filter, settings panel re-render)
    - `useDeferredValue` for outline tree re-flattening
    - `use()` for unwrapping promises during render
    See `ROADMAP.md` "React 19 features to leverage" for the full mapping.

12. **Use BaseUI for all UI code** (per `feedback-react19-and-baseui`, 2026-06-07). sapu's UI library is `@base-ui-components/react` (BaseUI). Do NOT use raw HTML elements when a BaseUI primitive exists. The migration from `@alifd/next` to BaseUI is a hard requirement, not a suggestion.
    - Plugin-setters must use BaseUI components (`Field`, `Switch`, `Select`, `Slider`, etc.) — not raw `<input>`/`<button>`/`<select>`
    - editor-skeleton widgets (header buttons, settings panel, popovers, tabs) must use BaseUI
    - L4+ additions (panels, dialogs, tooltips) must use BaseUI
    - For libraries that have no BaseUI equivalent (e.g. `react-arborist` for the outline tree), use the right tool
    - **Permission gate** (per `feedback-confirm-ali-and-third-party`): introducing a NEW third-party dep — including a BaseUI subpath we haven't used yet — needs user sign-off. Reusing already-declared peers (BaseUI, React, react-arborist, react-resizable-panels) is fine.

13. **Permission gates on `ali*` and new third-party resources** (per `feedback-confirm-ali-and-third-party`, 2026-06-07). Before introducing:
    - Any `ali*` token (identifier, comment, file name, UMD global, CSS class, build artifact) in sapu
    - Any new npm dep / CDN link / external resource

    …ask the user first. The brand scrub is deliberate; don't reintroduce the `ali*` prefix by accident. The dep surface shouldn't bloat casually. See `ROADMAP.md` "Permission gates" for the full rule and verification command.

14. **BaseUI + Tailwind for new UI code** (per `feedback-baseui-with-tailwind`, 2026-06-07). New UI code (L3+ with React 19) uses BaseUI primitives styled with Tailwind utility classes. The legacy injected `<style>` block in `editor-skeleton` is preserved for now (see principle #10); a one-time migration to Tailwind utilities is a P2.x follow-up. See `ROADMAP.md` "Styling strategy" for the migration plan and open questions.

## Build & test pipeline

Per-package `package.json` scripts:
- `build` → `tsc -p tsconfig.json` (CJS to `lib/`)
- `build:es` → `tsc -p tsconfig.esm.json && node ../../scripts/add-js-extensions.mjs es` (ESM to `es/`, then a script rewrites `from './foo'` to `from './foo.js'`)

ESM gotcha: raw Node ESM resolution requires explicit `.js` extensions in relative imports. TypeScript's default `module: "ES2020"` config emits `import './foo'` without the extension, which fails at runtime in Node ESM (but works in bundlers). The `add-js-extensions.mjs` post-build step fixes this.

`@monbolc/lowcode-ignitor` is the only package without a `build:es` (it ships only CJS for now).

Test pipeline (`yarn test` at root):
- Vitest 2.1 with `happy-dom` env
- `@testing-library/react` 16 + `@testing-library/jest-dom` 6
- Path aliases resolve cross-package imports to `src/` (not `lib/`)
- Esbuild `jsx: 'automatic'`

## What's NOT here yet

- **L5 (workspace)** — multi-window / multi-view support. The upstream has it; sapu is single-view.
- **L6 (shell)** — the `IPublicApi*` / `IPublicModel*` facade layer. Sapu exposes classes directly (e.g. `Project`, `DocumentModel`); no facades.
- **L7 (engine)** — the composition root. `@monbolc/lowcode-ignitor` is a placeholder; the real `init()` will live in a new `engine` package.
- **`@alilc/lowcode-engine-ext`** — upstream's external setter provider. Sapu ships its own setters in `plugin-setters` instead.
- **UMD bundles** — upstream has `build.umd.json` for `engine`, `react-renderer`, `react-simulator-renderer`. Sapu ships only CJS+ESM.
- **No `socket.io-client` / `fetch-jsonp` / `whatwg-fetch`** — upstream's `renderer-core` polyfills `fetch` for older browsers; sapu uses native `fetch`.

## Where to start reading

1. `@monbolc/lowcode-types` — read every export. It defines the schema.
2. `@monbolc/lowcode-utils` — `object.ts` + `emitter.ts` cover the foundational primitives.
3. `@monbolc/lowcode-renderer-core/adapter.ts` — the React injection seam.
4. `@monbolc/lowcode-editor-core/di.ts` + `plugin.ts` — the DI container and plugin manager.
5. `@monbolc/lowcode-designer/project.ts` + `document.ts` — the design model.
6. `@monbolc/lowcode-editor-skeleton/skeleton.tsx` — the 3-pane layout.
