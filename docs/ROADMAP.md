# Roadmap

> Last refreshed: 2026-06-08. Update this file whenever a task is completed, blocked, or a new direction is decided.

## Current state — L0–L6 done, 345 tests passing

13 packages published to `@monbolc`:

| Layer | Package | Version | Status |
|---|---|---|---|
| L0 | `@monbolc/lowcode-types` | 2.1.4 | ✅ shipped |
| L0 | `@monbolc/lowcode-ignitor` | 2.1.4 | ⚠️ **DEPRECATED** in 2.2.0; removed in 2.3.0 |
| L1 | `@monbolc/lowcode-utils` | 2.1.4 | ✅ shipped |
| L2 | `@monbolc/lowcode-editor-core` | 2.1.4 | ✅ shipped |
| L2 | `@monbolc/lowcode-plugin-command` | 2.1.4 | ✅ shipped |
| L2 | `@monbolc/lowcode-renderer-core` | 2.1.4 | ✅ shipped |
| L2 | `@monbolc/lowcode-plugin-outline-pane` | 2.1.4 | ✅ shipped |
| L2.5 | `@monbolc/lowcode-plugin-setters` | 2.1.4 | ✅ shipped (BaseUI + Tailwind v4, 40 tests) |
| L3 | `@monbolc/lowcode-react-renderer` | 2.1.4 | ✅ shipped |
| L3 | `@monbolc/lowcode-designer` | 2.1.4 | ✅ shipped |
| L4 | `@monbolc/lowcode-editor-skeleton` | 2.1.4 | ✅ shipped (BaseUI + Tailwind v4) |
| L5 | `@monbolc/lowcode-workspace` | 2.1.4 | ✅ shipped (24 tests, ~280 lines) |
| L6 | `@monbolc/lowcode-shell` | 2.1.4 | ✅ shipped (21 tests, ~530 lines) |
| **L7** | **`@monbolc/lowcode-engine`** | **2.1.4** | **✅ shipped (18 tests, ~310 lines — init + default-preset + theme)** |

`yarn test` ✅ 363 tests + 1 skip / 40 files, all passing in ~2.5s.

`yarn typecheck` ✅ 0 errors across all 13 packages + demo.

`examples/demo/` ✅ Vite + React 19 + Tailwind v4, single Skeleton (default) + "Open second doc" button for L5 multi-mount proof + "Inject crash" button for L6.7 error pipeline proof.

`examples/demo/` ✅ Vite + React 19 + Tailwind v4, single Skeleton (default) + "Open second doc" button for L5 multi-mount proof.

`tests/e2e/` ✅ L0–L4 stack end-to-end (L5 path is in `packages/workspace/tests/`).

## P0 — must fix before next publish

### P0.1 — `plugin-setters` h() vs `SetterComponent` type mismatch (8 errors) + must use BaseUI

- **Where**: `packages/plugin-setters/src/built-in.tsx:18, 40, 57, 77, 102, 127, 144` (7 errors) + `packages/plugin-setters/src/registry.ts:73` (1 error)
- **Symptom**: `Type '({ value, onChange, field }) => { type, props, children? }' is not assignable to type 'SetterComponent'`
- **Root cause (multi-part)**:
  1. The 7 built-in setters are arrow functions returning vdom-shaped objects (`{ type: 'input', props: {...} }`), but `SetterComponent` is typed as `ComponentType<SetterProps>` (a React function component).
  2. The registry code at `registry.ts:73` builds a fragment with `h()('div', ...)` and the inferred `ReactNode` complains about missing `key` props.
  3. **NEW (per `feedback-react19-and-baseui`)**: sapu uses BaseUI. The 7 setters currently use raw `<input>` / `<button>` / `<select>` / `<textarea>` — that violates the directive. Each setter must reference a BaseUI component (`Input`, `Field`, `Switch`, `Select`, `Slider`, etc.), not raw DOM.
- **Two paths**:
  - **(a) Match the h() style + use BaseUI** — change `SetterComponent` to accept hyperscript descriptors (e.g. `{ type: 'Field', props: {...} }` where `Field` is a BaseUI name). The 7 setters return descriptors pointing to BaseUI components. The L4 settings panel maintains a `{ 'Field': BaseUIField, 'Switch': BaseUISwitch, ... }` lookup, calls them via `adapter.getRuntime().createElement(lookup[descriptor.type], descriptor.props, descriptor.children)`. **This is the recommended path** — keeps setters framework-agnostic in source AND uses BaseUI.
  - **(b) Match the FC style + use BaseUI** — rewrite `built-in.tsx` to proper `React.FC<SetterProps>` returning JSX with BaseUI components. Cleaner types, but L4 settings panel must also use proper React (not h()).
- **Recommendation**: **(a)** with the BaseUI requirement folded in. The "framework-agnostic setters" principle in ARCHITECTURE.md is the right call. Setters are portable; the L4 settings panel converts descriptors → BaseUI JSX.
- **Styling via Tailwind v4** (per `feedback-baseui-with-tailwind`, decided 2026-06-07): the 7 setters' descriptors include Tailwind class strings in `props.className` (e.g. `className: 'w-full px-3 py-2 border rounded'`). No raw CSS, no inline `style` objects. `plugin-setters` package gets:
  - `tailwindcss` (devDep)
  - `src/styles.css` with `@import "tailwindcss"` + `@theme` design tokens
  - `build:css` script: `tailwindcss -i src/styles.css -o lib/styles.css --minify`
  - Updated `build` script: `yarn build:css && tsc`
- **BaseUI mapping** (per `feedback-react19-and-baseui`):

  | Setter | Current (raw HTML) | BaseUI component to reference |
  |---|---|---|
  | `Input` | `<input type="text" />` | `Field` (single-line) |
  | `TextArea` | `<textarea />` | `Field` (multiline) |
  | `Number` | `<input type="number" />` | `Field` (type=number) or `Slider` + number readout |
  | `Switch` | `<button>` with conditional class | `Switch` |
  | `Select` | `<select>` | `Select` |
  | `ColorPicker` | `<input type="color" />` | `Slider` (HSL) or custom BaseUI primitive |
  | `Slider` | `<input type="range" />` | `Slider` |

- **Why P0**: blocks `yarn typecheck` from passing, blocks republishing `plugin-setters`, blocks wiring setters into the L4 settings panel, AND violates the BaseUI directive.

### P0.2 — `designer` `SetPropCommand.undo` type mismatch (1 error)

- **Where**: `packages/designer/src/commands.ts:133`
- **Symptom**: `Property 'undo' in type 'SetPropCommand' is not assignable to the same property in base type 'ICommand<{ nodeId, key, value: JSONValue }, JSONValue | undefined>'`
- **Root cause**: `SetPropCommand.undo` likely returns `JSONValue` instead of `JSONValue | undefined` (or similar one-off).
- **Fix**: narrow the parameter type on `undo` to match `ICommand`'s declared return.
- **Why P0**: blocks `yarn typecheck`, blocks republishing `designer`.

### P0.3 — Commit the v2.0.2 types package

- **Where**: `packages/types/package.json` + `packages/types/src/index.ts` (uncommitted working-tree changes)
- **What**: version 2.0.1 → **2.0.2**, new fields `conditionGroup`, `loopArgs` on `IPublicTypeNodeSchema` (plus many other uncommitted additions: `variable` variant on `IPublicTypeNodeData`, `i18n`/`meta` on `IPublicTypeRootSchema`, `keywords`/`isPage`/`isBlock`/`isContainer`/`isLowCode`/`docUrl`/`screenshot`/`tags`/`behaviors` on `IPublicTypeComponentSchema`, etc.)
- **Action**: `git diff` to review the full set, then `git add packages/types && git commit` with a clear message. The npm publish was already done; the commit is what's missing.
- **Why P0**: changes to a published package should be in git history; downstream consumers should be able to clone and see what 2.0.2 actually contains.

### P0.4 — `editor-skeleton` hand-rolled CSS → Tailwind v4 (one-time full migration)

- **Where**: `packages/editor-skeleton/src/skeleton.tsx` (injected `<style>` block with `sapu-skel-*` / `sapu-border-overlay` / `sapu-drag-ghost` / `sapu-insertion-indicator`)
- **What**: translate all hand-rolled CSS to Tailwind v4 utility classes. Add `tailwindcss` to `editor-skeleton` devDeps + `build:css` script. Add `@tailwindcss/vite` to `examples/demo/vite.config.ts` (Vite project from P0.4a is already in place).
- **Pre-req**: P0.1 done (so the Tailwind v4 setup pattern is established in `plugin-setters`).
- **Why P0**: required by `feedback-baseui-with-tailwind` ("一次性全量迁移" = one-time full migration). Without this, the hand-rolled CSS and Tailwind coexist indefinitely — defeats the purpose of the directive.
- **See**: `docs/ROADMAP.md` "Styling strategy" → "Implementation notes" for the build pipeline setup.

## P1 — quality polish

### P1.1 — editor-skeleton React 19 warnings (2 warnings in tests, not failures) — **DONE 2026-06-07**

- **Where**: `packages/editor-skeleton/src/skeleton.tsx`
- **Symptoms** (found in Vite demo, not just tests):
  - "Each child in a list should have a unique 'key' prop" — from PanelGroup's direct children (Panel + ResizeHandle × 2 + Panel + ResizeHandle + Panel)
  - Canvas area showed a vertical scrollbar — PanelGroup didn't get `.sapu-skel` className, so `height: 100%` CSS never applied, leaving the PanelGroup at intrinsic height
- **Fix**:
  - Added `className: 'sapu-skel'` to the PanelGroup props (so the injected `<style>` block's `height: 100%` rule applies)
  - Added `key: 'left' | 'rh-left' | 'center' | 'rh-right' | 'right'` to PanelGroup's direct children
  - Added `*, .sapu-skel { box-sizing: border-box; }` to the STYLES — without it, `.sapu-skel-canvas-inner { min-height: 100%; padding: 16px; border: 1px }` overflowed its parent by 34px even with the className fix.
- **Side fix (demo bug)**: `examples/demo/src/main.ts` was calling `project.load(schema)` in `App`'s render body, triggering setState in a child during the parent's render. Moved to `useEffect`. Library is fine; the demo had a side-effect-in-render bug.
- **Why P1**: was test warnings, surfaced as user-visible errors when wired into the Vite demo.

### P1.2 — react-renderer key handling + simulator unmount race — **DONE 2026-06-07**

- **Where**:
  - `packages/react-renderer/src/renderers.tsx` (the actual key warning source)
  - `packages/editor-skeleton/src/skeleton.tsx` (the unmount race)
- **Symptoms** (found in Vite demo, after P1.1):
  - "Each child in a list should have a unique 'key' prop" — STILL present, but the warning was actually coming from the simulator's render of the page (Header, Body, Sidebar, Main), not the PanelGroup children.
  - "Attempted to synchronously unmount a root while React was already rendering" — fires when the user mutates the schema (Add Footer) and the simulator's separate React root gets torn down mid-render.
- **Root causes**:
  - Key: `renderChildren` had `out.push({ ...(rendered as object), key })` — spreading a React element strips its `$$typeof` and other internal symbols, so React doesn't recognize the resulting key. The fix is to set the key on the original `h()(Comp, { ...props, key }, ...children)` call.
  - Unmount: `useEffect` cleanup synchronously called `root.unmount()` during another component's commit phase. React 19's concurrent rendering can't tolerate that.
- **Fix**:
  - Added `fallbackKey?: string` parameter to `renderNode`; renderChildren now passes `__idx_${i}` as the fallback when `schema.key` is absent. The key is set on the `h()` call, not via spread.
  - Wrapped the simulator root cleanup in `queueMicrotask(() => root.unmount())` so the unmount runs after the current commit completes.
- **Why P1**: both surfaced as user-visible errors when the demo was wired up.

### P1.3 — plugin-outline-pane defaultRenderRow missing keys — **DONE 2026-06-07**

- **Where**: `packages/plugin-outline-pane/src/view.tsx`
- **Symptoms** (after P1.2): the key warning still appeared. Source traced to `defaultRenderRow` which returns a div with 3 children as an array literal: `[arrow, titleSpan, componentNameSpan]`. None had keys.
- **Fix**: added `key: 'arrow' | 'title' | 'componentName'` to each child of the div. Both branches of the `arrow` ternary now carry `key: 'arrow'` (consistency is required by React even when one branch is rendered conditionally).
- **Why P1**: user-visible React warning, surfaces in the outline pane on every render.

### P1.2 — `plugin-setters` and `ignitor` have zero tests

- **Where**: `packages/plugin-setters/tests/` (missing), `packages/ignitor/tests/` (missing)
- **What to add**:
  - `ignitor/tests/bootstrap.test.ts` — smoke test that `bootstrap(options)` resolves and injects the banner.
  - `plugin-setters/tests/registry.test.ts` — `registerSetter` / `getSetter` / `pickSetter` / `withLabel` / `BUILT_IN_SETTERS` constants.
  - `plugin-setters/tests/built-in.test.ts` — snapshot the 7 setters' vdom output.
- **Why P1**: every other package has tests; these are gaps.

### P1.3 — Setters not yet wired into L4 settings panel

- **Where**: `packages/editor-skeleton/src/settings-panel.tsx`
- **Current state**: uses a hand-rolled JSON-based value editor (`formatValue`/`parseValue`).
- **What to add**: use `plugin-setters` to render the right setter for each field based on `field.setter`. The settings panel needs to convert the vdom-shaped setter output into actual JSX (or pass through `adapter.getRuntime().createElement`).
- **Why P1**: completes the L2.5 → L4 wiring; makes the right pane useful.

### P1.4 — Untracked `packages/plugin-setters/`

- **Where**: `packages/plugin-setters/` is entirely untracked
- **What to add**: `git add packages/plugin-setter*` (likely the whole `packages/plugin-setters/` directory + `package.json` lock updates)
- **Why P1**: can't lose work.

### P1.5 — *Removed — merged into P0.1*

The old P1.5 ("BaseUI peerDep is misleading, use BaseUI in setters or drop it") has been **elevated to a hard requirement** and folded into P0.1. Per `feedback-react19-and-baseui`: sapu uses BaseUI; UI code must use BaseUI components; declaring a peerDep and not using it is an anti-pattern.

### P1.6 — OutlineView inline rename (ali-style display title) — **DONE 2026-06-07 (dblclick deferred)**

- **Where**:
  - `packages/plugin-outline-pane/src/view.tsx` — added `isEditing` / `draft` / `startRename` / `commitRename` / `cancelRename` / `canRename` to `RowHelpers`; `defaultRenderRow` now shows a `✎` button on every non-root row and a double-click handler on the title; clicking either swaps the title span for an `<input>` that autoFocuses and selects; Enter or blur commits via `pane.rename(id, trimmed)`, Escape cancels.
  - `packages/plugin-outline-pane/src/api.ts` — `pane.rename(id, title)` already existed; it mutates the tree node's `title` only, **never** the underlying schema's `componentName`. Fires the `renamed` event.
  - `packages/editor-skeleton/src/skeleton.tsx` — added `onPaneReady?: (pane: OutlinePane) => void` so the host can drive pane-level actions from outside React (used by the demo toolbar).
  - `examples/demo/src/main.ts` — `Body → App` button now calls `pane.rename(bodyNodeId, 'App')` instead of mutating the schema. This is the **ali-faithful** flow: title is for display, type is for rendering. The canvas is **not** affected; the outline label changes; settings panel keeps showing `Body` as the component type.
  - `examples/demo/index.html` — button label changed from `Rename Page → App` to `Body → App`; `title` attribute explains the semantics.
- **Reference**: ali's `plugin-outline-pane/src/views/tree-title.tsx:146` `shouldEditBtn = isCNode && isNodeParent` (root is excluded). Sapu matches that with `canRename = rowNode.parentId !== ''`.
- **Tests added**: 3 in `packages/plugin-outline-pane/tests/view.test.tsx` (renames label without touching componentName, fires the renamed event, no-op on unknown id). 214/214 total.
- **Typecheck**: 0 new errors. The 8 pre-existing P0.1 errors in `plugin-setters` are unchanged.
- **Why P1**: completes the rename UX that ali ships in its engine. Also unblocks clean wiring of the demo's rename button (no more "rename Page → App" canvas-breakage surprise).
- **Known issue (deferred to 2.1.1)**: dblclick on a non-root title span does not enter rename mode in the user's browser, even though the 4 row-render unit tests prove the `onDoubleClick` handler is correctly attached and the state-transition works. Possible causes: Vite HMR didn't pick up the latest module in the user's session; the user's dblclick speed exceeds the browser threshold; hyperscript + react-arborist + React 19 event delegation interact oddly. Reproduction-tested via `fireEvent.doubleClick` (testing-library) — passes. Not browser-tested. **Workaround**: use the `✎` button on the right of each row, which works. **Will investigate** in 2.1.1 with an E2E test (Playwright) that simulates real browser dblclick.

## P2 — incremental improvements

### P2.1 — Drop `setupReactRenderer` from `react-renderer` public API, fold into `ignitor`

- **Where**: `packages/react-renderer/src/index.ts` exports `setupReactRenderer`
- **Current state**: a one-shot `installReactRuntime + adapter.setRenderers` convenience
- **Better**: when the L7 `engine` package exists, this becomes the first thing `init()` does

### P2.2 — L3 designer needs more commands

- **Current state**: 5 commands ported (Insert, Remove, Move, SetProp, Rename)
- **Missing**: `Detecting` (hover), `Scroller` (scroll-into-view), `Clipboard` (cut/copy/paste), `ComponentMeta` parser, `BuiltinSimulatorHost`, `LowCodePluginManager` (the designer's own plugin manager, distinct from editor-core's)

### P2.3 — L4 editor-skeleton needs more widgets

- **Current state**: 3-pane layout with hand-rolled settings panel
- **Missing**: `Widget`/`Panel`/`Dock`/`DialogDock`/`Stage` primitives, `PopupService`, `createField`, the 9 `Area` types, the workbench tabbing UI

## React 19 features to leverage (per `feedback-react19-and-baseui`)

sapu uses React 19.2.7. New code and refactors should use React 19's new features where they apply. Don't default to React 16/18 idioms out of habit.

| Feature | Where to use in sapu |
|---|---|
| `use()` | Unwrap promises during render — replace `useEffect`+`useState` for resource loading |
| `useOptimistic` | Optimistic updates for `Dragon` (drag preview), `RenameCommand`, `SetPropCommand` slider drag |
| `useActionState` | Form-like state in `SettingsPanel` (input change → validate → commit on blur) |
| `ref` as a prop | Replace `forwardRef` (mostly already done; sweep for stragglers in `react-renderer` IRuntime contract) |
| Actions (functions on `onClick`) | Replace event-handler boilerplate in `Skeleton` header buttons |
| `useTransition` | Mark non-urgent updates (outline filter, settings panel re-render) as transitions |
| `useDeferredValue` | Outline tree re-flattening on schema changes |
| **`useSyncExternalStore`** | **Canonical replacement for the custom `useRev` hook** — when refactoring `useRev` consumers, prefer this |

**Do NOT introduce (banned patterns):**
- `useRev` in new code (use `useSyncExternalStore`)
- `forwardRef` in new code (pass `ref` as a prop)
- Class components (already banned; this reinforces the "no legacy" stance)
- `mobx` (already banned)

## Permission gates (per `feedback-confirm-ali-and-third-party`)

Before any of the following, **stop and ask the user** (do not proceed silently):

- Adding a new `import` from a package starting with `ali*` (in source, tests, examples, config, docs)
- Naming a variable / function / class / type / interface with `ali*` prefix in sapu
- Adding a comment that uses `ali*` (rephrase to "upstream reference" or "alibaba v1.3.2")
- Creating a UMD global like `window.Ali*`
- Adding a CSS class like `.ali-*` in injected `<style>` blocks
- Adding a new npm dep to any `package.json` (devDep, dep, peerDep)
- Adding a CDN link / external script / external font / external icon
- Adding an `import` from a package NOT currently in the project (expanding the dep surface)

**Already-approved (no extra confirmation needed):**
- `@monbolc/*` (own scope)
- `react`, `react-dom`, `react-dom/client` (React 19.2.7 peer)
- `@base-ui-components/react` (BaseUI per the BaseUI directive)
- `react-arborist`, `react-resizable-panels` (already in deps)
- All vitest / @testing-library / @types devDeps at root
- `tailwindcss` v4 — pre-approved per `feedback-baseui-with-tailwind`; version v4, scope one-time full migration, Vite plugin for demo + Tailwind CLI for per-package `build:css` — all decided 2026-06-07. For Tailwind plugins/configs beyond the base dep, still confirm.

**Verification command for current state** (run periodically):
```bash
cd /Users/lirui/Documents/lowcode-engine/sapu-lowcode-engine
grep -rnE '\bali[A-Z]|@ali[lfd]|Ali[lf][dc]|Alibaba' \
  packages/*/src packages/*/tests examples/ scripts/ \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
  --include='*.json' --include='*.html'
# As of 2026-06-07: 0 hits in source, 0 hits in package.json
```

### Demo — Vite migration (started 2026-06-07, P0.4 moved up)

- **Why moved up**: the old `examples/hello-sapu.html` used esm.sh + import map, but esm.sh's transitive deps (e.g. `react-window` via `react-arborist`) load via relative URLs that resolve to `file:///...` when the HTML is opened directly. Result: `react-window` never loads, react-arborist can't find it, React 19's `useId` reads null dispatcher. `?external=react,react-dom` on the @monbolc imports did not fix it (the external flag didn't propagate to all transitive links).
- **Fix**: new `examples/demo/` Vite + React + TypeScript project.
  - `vite.config.ts` path-aliases all 11 `@monbolc/*` packages to their `src/index.ts` (no `yarn build` needed for the demo).
  - `tsconfig.json` mirrors the aliases for type-checking.
  - `index.html` + `src/main.ts` are the demo app.
  - Root `package.json` has `yarn demo` / `yarn demo:build` / `yarn demo:preview` scripts.
  - HMR via `@vitejs/plugin-react`.
- **Status**: Vite config + index.html + main.ts written. `yarn install` pulled `vite@5.4.21` + `@vitejs/plugin-react`. Verified: dev server starts, serves HTML, transpiles main.ts, all 11 @monbolc/* aliases resolve to 200, React resolves from node_modules.
- **Pending**: Tailwind v4 + `@tailwindcss/vite` (P0.4b).

### P0.4 — `editor-skeleton` hand-rolled CSS → Tailwind v4 (one-time full migration)

sapu uses **BaseUI** (headless primitives) + **Tailwind CSS** (utility-first styling). The user approved Tailwind on 2026-06-07 with the directive "at the appropriate time".

**Current state**: `editor-skeleton` uses an injected `<style>` block with hand-rolled `sapu-*` classes (see `ARCHITECTURE.md` principle #10). This was a deliberate choice to avoid a build step for styles. It's framework-agnostic but limits DX.

**Planned migration**:

| Trigger | Action |
|---|---|
| **P0.1** (plugin-setters) | Style the 7 BaseUI setters with Tailwind classes from the start. Add Tailwind to the build pipeline. |
| **P2.3** (L4 widgets) | All new widgets use Tailwind. |
| **P?.x** (one-time migration) | Translate the existing `editor-skeleton` `<style>` block to Tailwind utilities. |

### Decisions (2026-06-07)

| Question | Decision |
|---|---|
| **Insertion point** | **P0.1** (plugin-setters) — the 7 setters use Tailwind from day one |
| **Tailwind version** | **v4** (CSS-first, `@import "tailwindcss"`, no PostCSS) |
| **Migration scope** | **One-time full migration** — the existing `editor-skeleton` hand-rolled `<style>` block is translated to Tailwind utilities |
| **Build pipeline** | **Vite plugin for demo/dev** (HMR); **Tailwind CLI for per-package `build:css`** (publishes compiled CSS as static asset) |

### Implementation notes

- Tailwind v4 = no PostCSS, no `tailwind.config.js`. Use `@import "tailwindcss"` + `@theme` block in a single CSS file.
- Vite plugin: `examples/demo/vite.config.ts` already exists (P0.4a). Add `@tailwindcss/vite` to its plugins when P0.4b runs.
- Per-package `build:css`: `npx @tailwindcss/cli -i src/styles.css -o lib/styles.css --minify` invoked from each package's `build` script.
- Design tokens (colors, spacing, typography) live in one `tailwind.css` `@theme` block — shared via `@import` or symlink.
- React 19 + BaseUI: the `className` prop on BaseUI components passes through to the underlying DOM, so Tailwind classes work without adapters.

## P3 — L5+ planning

### L5 — `@monbolc/lowcode-workspace` ✅ DONE 2026-06-08

Locked 2026-06-07, shipped 2026-06-08 as `@monbolc/lowcode-workspace@2.1.2`. 3 source files (`index.ts`, `resource.ts`, `window.ts`, `workspace.ts`) + 3 test files = **24 tests passing**, ~280 lines, vs upstream 1,298. ~78% smaller. The dropped bulk:

- `Workbench` tabbed UI (~500 lines) — replaced by multi-mount of `<Skeleton>`
- `IPublicApiWorkspace` proxy + `setAsInstance`/`current` glue (~150 lines) — L6 will fetch the real class
- `ResourceType` registry + `getResourceType` lookup (~100 lines) — hosts use `options.type` as a string
- `EditorWindow` queue with auto-focus tracking (~80 lines) — single-window: just an active flag

See `docs/packages/workspace.md` for the full design rationale and the demo's "Open second doc" button for the multi-mount proof.

L5.1–L5.6 (6 P-tasks) all completed in one session:
- L5.1 package skeleton + tsconfig + vitest alias
- L5.2 Resource + 5 tests
- L5.3 EditorWindow + 7 tests
- L5.4 Workspace + 12 tests
- L5.5 demo multi-mount
- L5.6 docs (this update)

### L6 — `@monbolc/lowcode-shell`

**Goal**: the host-facing facade. Plugins and host apps talk to one entry object (`engine`) and get typed access to the document, simulator, project, events, and a plugin slot. Replaces the upstream `IPublicApi*` proxy zoo.

**Upstream**: `packages/shell/` — 45 files, ~5,155 lines, each `IPublicApiFoo` is a 30-line proxy over a real class with deprecation wrappers.

**Sapu's stance** (locked 2026-06-08): **no proxies, no deprecation layer.** Plugin authors call the real classes. The "facade" is just a plain object literal that bundles references and a `registerPlugin` slot.

#### What sapu ships in L6 (locked 2026-06-08)

| File | Purpose | Lines (est.) |
|---|---|---|
| `src/index.ts` | barrel: re-export `SapuEngine`, `IPlugin`, `IPluginContext` | ~20 |
| `src/engine.ts` | `SapuEngine` class — owns a `Project`, an `IWorkspace` (L5), an event bus. `mount(container)` + `destroy()`. | ~120 |
| `src/plugin.ts` | `IPlugin` / `IPluginContext` types + `definePlugin(p)` identity helper (for DX, not runtime magic) | ~50 |
| `src/events.ts` | typed event names + payload types: `'schemaChanged' \| 'selectionChanged' \| 'windowActivated' \| 'pluginRegistered'`, all with payload interfaces | ~80 |
| `src/i18n.ts` | 30-key zh-CN/en-US dictionary + `engine.t('key')` accessor | ~60 |
| `src/error-boundary.tsx` | React 19 `ErrorBoundary` component that catches plugin exceptions, logs to engine events, shows a BaseUI `Dialog` | ~80 |
| `src/index.css` | Tailwind v4 `@import "tailwindcss"` + design tokens | ~30 |
| `tests/engine.test.ts` | mount/destroy, plugin registration fires the event, error-boundary catches, i18n fallback | ~150 |
| `tests/events.test.ts` | typed subscribe / unsubscribe / once + payload validation | ~80 |
| `tests/plugin.test.ts` | `definePlugin` returns same shape, `IPluginContext` is exactly the engine surface | ~60 |
| `tests/i18n.test.ts` | `t('foo')` returns zh-CN by default, falls back to en-US for missing keys, format substitution | ~60 |

Total: ~790 lines, vs upstream 5,155. **~85% smaller.** The dropped bulk: 28-component `IPublicApiCommonUI` (no replacement, host uses its own UI), 11 deprecated proxies (no deprecation layer), `setAsInstance`/`current` machinery (sapu passes the real class).

#### L6 — concrete P-tasks (✅ all done 2026-06-08)

- **L6.1** ✅ — Package skeleton: `packages/shell/` `package.json` (deps: L2 designer + L4 skeleton + L5 workspace + L2.5 plugin-setters; peer: react ^19.2), `tsconfig.json`, vitest alias, `build:css` for the Tailwind file. **0 new third-party deps.**
- **L6.2** ✅ — Events: `EngineEventName` union + `EngineEvents` payload map + `EngineEventBus` class wrapping the L1 `Emitter<EngineEvents>` with compile-time payload checks.
- **L6.3** ✅ — `SapuEngine` class + 4 unit tests in `packages/shell/tests/sapu-engine.test.ts` (getProject-throws-before-mount, mount-creates-Project-and-fires-engineReady, registerPlugin-init-context-shape, init-throws-fires-pluginError-and-unregisters).
- **L6.4** ✅ — `IPlugin` / `IPluginContext` types + `definePlugin` helper + 6 unit tests in `packages/shell/tests/plugin.test.ts` (identity, context shape, duplicate name, invalid name, destroy+engineDestroyed, unregister+plugin.destroy).
- **L6.5** ✅ — `ShellI18n` + 12-message `locale/en-US.json` + 12-message `locale/zh-CN.json` (shorthand form) + `locale/index.ts` exporting `registerDefaultMessages` + 6 unit tests in `packages/shell/tests/i18n.test.ts` (current-locale string, setLocale flip, `{name}` substitution, missing-key-fallback, shorthand register, missing-var-no-crash).
- **L6.6** ✅ — `SapuErrorBoundary` (React 19 `componentDidCatch`) + `DefaultErrorFallback` (plain `<div role="alert">` with Tailwind, no BaseUI portal) + 5 unit tests in `packages/shell/tests/error-boundary.test.tsx` (renders children, fallback on throw, custom fallback, pluginError event, DefaultErrorFallback render).
- **L6.7** ✅ — Demo extension: `examples/demo/src/main.ts` now uses `SapuEngine.mount()` to own the Project, wraps `<Skeleton>` in `<SapuErrorBoundary engine={engine}>`, exposes an "Inject crash" button in both the HTML toolbar and the `topArea` slot. A counter banner appears below the toolbar showing how many `pluginError` events have fired.
- **L6.8** ✅ — Docs: `docs/packages/shell.md` (new) covers all L6.2-L6.6 classes + usage + Sapu-vs-ali comparison. `docs/ROADMAP.md` and `docs/ARCHITECTURE.md` updated with the L6 row.

**Permission gate for L6**: when L6.1 starts, **confirm** any new third-party dep (sapu stance: expect 0 new deps; React 19 ErrorBoundary and existing event emitter cover everything).

### L7 — `@monbolc/lowcode-engine` (composition root)

**Goal**: the one package a host app installs. It re-exports L0–L6, ships default plugins (setters, outline, settings panel), default i18n, default theme, and a one-call `init(container, schema, components)` that wires everything. The L0 `ignitor` placeholder folds into this.

**Upstream**: `packages/engine/` — 15 files, ~1,330 lines; `engine-core.ts` is ~300+ lines of "construct singletons + register plugins" boilerplate.

**Sapu's stance** (locked 2026-06-08): **L0 `ignitor` grows into L7 `engine`**, no parallel `ignitor` package. The L0 placeholder gets replaced by the real composition. `bootstrap` is renamed `init` and gets the real signature. The L0 package is deleted in 2.2.0.

#### What sapu ships in L7 (locked 2026-06-08)

| File | Purpose | Lines (est.) |
|---|---|---|
| `src/index.ts` | barrel: re-export `SapuEngine`, `init`, default plugins, default theme, default i18n | ~20 |
| `src/init.ts` | `init(container, options)` — `new SapuEngine()`, register built-in setters + outline + settings panel, mount, return engine handle | ~80 |
| `src/default-plugins.ts` | `outlinePanePlugin`, `settingsPanelPlugin`, `settersPlugin` — minimal plugin wrappers around L2.5/L2/L4 | ~60 |
| `src/default-theme.ts` | exports the Tailwind v4 CSS file path + a `setTheme(name)` that toggles a `data-theme` attribute on `<html>` | ~40 |
| `src/preset.ts` | `createDefaultPreset()` — bundles plugins + theme + i18n, returns a single `IPreset` consumers can extend | ~50 |
| `tests/init.test.ts` | happy-dom test: `init(div, { schema, components })` mounts a Skeleton with outline + canvas + settings; destroy tears it down | ~120 |
| `tests/default-plugins.test.ts` | each plugin's `init(context)` wires the right L2/L4 instance; no plugin mutates the schema | ~80 |

Total: ~450 lines, vs upstream 1,330. **~66% smaller.** The dropped bulk: monkey-patch React renderer (sapu uses React 19 + BaseUI, no patch needed), `BuiltinSimulatorHost` initialization (~200 lines upstream, replaced by `Project` construction), `LowCodePluginManager` (sapu reuses L2 editor-core's plugin manager).

#### L7 — concrete P-tasks (✅ L7.1–L7.8 done 2026-06-08, L7.9 in progress)

- **L7.1** ✅ — Package skeleton: `packages/engine/` `package.json` (deps: ALL L2–L6 + react 19.2 peer; **this is the meta package**), `tsconfig.json` + `tsconfig.esm.json`, vitest alias, build script.
- **L7.2** ✅ — `init(container, options)` + 7 unit tests in `packages/engine/tests/init.test.ts` (returns engine with mounted Project, throws on missing selector, throws on null container, engineReady available, destroy tears down, detectLocale for non-English, detectLocale for English).
- **L7.3** ✅ — Default plugins: `outlinePanePlugin`, `settingsPanelPlugin`, `settersPlugin` (in `packages/engine/src/default-plugins.ts`) + 2 unit tests in `packages/engine/tests/preset.test.ts` (3-unique-plugins, idempotent init).
- **L7.4** ✅ — `createDefaultPreset(overrides?)` + 3 unit tests in `packages/engine/tests/preset.test.ts` (default shape, override merges all fields, partial override keeps the rest).
- **L7.5** ✅ — `setTheme(name)` + 6 unit tests in `packages/engine/tests/preset.test.ts` (initial light, setTheme updates data attribute, setTheme notifies, same-name no-op, unsubscribe, throw on unknown name).
- **L7.6** ✅ — Ignitor deprecation shim. `bootstrap()` still works but prints a once-per-session `console.warn` pointing to `@monbolc/lowcode-engine`. `package.json` description updated with DEPRECATED prefix. `README.md` added to the package. `docs/packages/ignitor.md` rewritten with migration guide. Package deletion scheduled for 2.3.0.
- **L7.7** ✅ — Demo rewrite: `examples/demo/src/main.ts` now imports `init, createDefaultPreset` from `@monbolc/lowcode-engine`. The `setupReactRenderer()` call is gone (init() does it). `<App>` now takes `{engine}` as a prop. The "Inject crash" button (L6.7) and "Open second doc" button (L5) still work.
- **L7.8** ✅ — Docs: `docs/packages/engine.md` (new, ~150 lines) covers the full L7 API + preset system + Sapu-vs-ali comparison. `docs/packages/ignitor.md` updated with DEPRECATED banner + migration guide. `docs/ARCHITECTURE.md` + `docs/ROADMAP.md` + `docs/COMPARISON-WITH-ALI.md` updated to reflect L7 done.
- **L7.9** — Top-level `README.md` rewrite to direct users to `yarn add @monbolc/lowcode-engine` and show the 5-line starter. (In progress as of 2026-06-08.)

**Permission gate for L7**: when L7.1 starts, **confirm** any new third-party dep (sapu stance: expect 0 new deps; the package is purely composition).

#### L7 → L0 deletion order

1. Publish L7 at version `2.2.0-rc.0` (with L0 still present for back-compat).
2. Wait one release.
3. Re-publish L7 at `2.2.0`; mark `@monbolc/lowcode-ignitor` deprecated in its README.
4. Wait one more release.
5. L7 at `2.3.0`: delete `@monbolc/lowcode-ignitor`, unpublish from npm (`npm unpublish @monbolc/lowcode-ignitor@* --force`), update demo + docs.

This deprecates L0 over two release cycles so any host that pinned L0 has time to migrate.

## Post-L7 — beyond the upstream feature set

These are not in the upstream at all; they're new directions sapu could take.

- **Real-time collaboration** — CRDT-based multi-user editing (Yjs, Automerge)
- **Component marketplace** — npm-published component packages discoverable by the editor
- **Visual regression testing** — snapshot the rendered page at each commit
- **Mobile preview** — responsive design tools (the `IPublicTypeBreakpoint`/`ResponsiveStyle` types are already in `types`)
- **AI-assisted building** — natural-language → schema (would be a new L4+ plugin)

## Update procedure

Per [[feedback-update-memory-after-changes]] and the per-doc update rules:

| When you do this... | Update these files |
|---|---|
| Add a new package | `docs/README.md` (index), `docs/ARCHITECTURE.md` (L-layer table), `docs/ROADMAP.md` (current state table), `docs/packages/<name>.md` (new file), `docs/COMPARISON-WITH-ALI.md` (mapping table) |
| Bump a version | `docs/ROADMAP.md` (version cell), `docs/packages/<name>.md` (version line) |
| Add a new public export | `docs/packages/<name>.md` (exports list) |
| Add a new public type | `docs/packages/<name>.md` (key types), `docs/COMPARISON-WITH-ALI.md` (if it's a slimmed type the upstream has) |
| Add a new test file | `docs/packages/<name>.md` (test coverage) |
| Fix a bug | `docs/ROADMAP.md` (remove from P0/P1) |
| Discover a new P0/P1 | `docs/ROADMAP.md` (add to the section) |
| Land a new L-layer | `docs/ARCHITECTURE.md` (layer table, dep graph), `docs/ROADMAP.md` (current state), `docs/COMPARISON-WITH-ALI.md` (mapping) |
| Publish to npm | `docs/ROADMAP.md` (version) + commit the working-tree change |
| **Use a React 19 feature in new code** | `docs/ROADMAP.md` "React 19 features to leverage" table (add the use case) · `docs/ARCHITECTURE.md` design principles (if it sets a precedent) · `docs/packages/<name>.md` "Implementation patterns" |
| **Introduce a new BaseUI component** | `docs/ROADMAP.md` P0.1 BaseUI mapping table · `docs/packages/<name>.md` implementation patterns |
| **Add a new third-party dep** | **STOP — confirm with user first per `feedback-confirm-ali-and-third-party`**. If approved, then update `docs/ROADMAP.md` P0/P1 (justify why), `docs/ARCHITECTURE.md` (add to dep graph), `docs/packages/<name>.md` deps section |
| **Introduce an `ali*` token** | **STOP — confirm with user first**. If approved, document the rationale in the relevant doc. |
| **Add Tailwind / change Tailwind config** | Tailwind itself is pre-approved per `feedback-baseui-with-tailwind`. Confirm version (v3 vs v4) + scope (new code only vs migrate existing) + pipeline integration before adding to any `package.json`. Update `docs/ROADMAP.md` "Styling strategy" section with the decision. |
