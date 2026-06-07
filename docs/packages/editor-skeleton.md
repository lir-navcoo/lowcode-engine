# `@monbolc/lowcode-editor-skeleton` (L4)

> **Version**: 2.0.3 · **Uses `react-resizable-panels`** · **12+ tests** · **⚠️ 2 React 19 test warnings**

## Purpose

The 3-pane editor UI: left (Outline) / center (Simulator canvas) / right (Settings). This is the L4 surface that users actually interact with. End-to-end demo `examples/hello-sapu.html` uses the real `Skeleton`.

## Public exports

### React components
- `Skeleton` + `SkeletonProps` — the 3-pane layout
- `SettingsPanel` + `SettingsPanelProps` — the right-side properties editor
- `Overlays` + `OverlaysProps` — DOM-level overlay manager (returns `null`, writes directly to `canvasContainer`)

## Key types

```ts
interface SkeletonProps {
  project: Project;                                    // from @monbolc/lowcode-designer
  components: Record<string, unknown>;
  leftSize?: number;                                   // default 20
  rightSize?: number;                                  // default 24
}

interface SettingsPanelProps {
  project: Project;
}

interface OverlaysProps {
  project: Project;
  canvasContainer: HTMLElement | null;
}
```

## Implementation patterns

- **3-pane layout** via `react-resizable-panels`: left (Outline) / center (Simulator canvas) / right (Settings)
- `Skeleton` mirrors the project's `document.root` into a local `OutlinePane` instance via `useEffect`. Subscribes to `document.events` and re-calls `pane.setSchema(...)` on every event
- The simulator is mounted imperatively into a ref'd `canvasHost.current` div: builds the `Simulator`, calls `sim.render()`, then `createRoot(inner).render(el)`. Cleanup unmounts on dep change
- **Inline styles + a single `STYLES` CSS string** injected once via `injectStyles()` (idempotent). The package deliberately avoids CSS-in-JS to keep it framework-agnostic and to avoid a build step for styles
- **Imperative overlay rendering** in `Overlays.tsx`: the React component returns `null` and writes DOM directly into `canvasContainer` (creates `div.sapu-border-overlay`, `div.sapu-hover-overlay`, `div.sapu-drag-ghost`, `div.sapu-insertion-indicator`). This is a deliberate choice to avoid fighting React reconciliation on overlay divs
- **`h()()` resolver** in all 3 files: `const h = () => adapter.getRuntime().createElement as ...`
- `useRev(project)` hook pattern for forcing re-renders on project events
- **Settings panel implements its own minimal "value editor"** (`formatValue`/`parseValue` JSON roundtrip) — **not using the plugin-setters from L2.5 yet**. The plumbing is in place; setters are not yet wired into the settings panel
- `prompt()` is used for rename; the component is intentionally simple
- All `.sapu-*` class names are stable test selectors

## Test coverage

- 4 test files, 12+ tests
- `overlays.test.tsx` (4): border overlay, drag ghost, ghost cleared, insertion indicator
- `skeleton.test.tsx` (2): 3-pane headers, project exposed
- `settings-panel.test.tsx` (3): empty hint, props visible, click-to-edit + Enter commits
- `e2e.test.tsx` (5): mount headers, empty hint, select shows props, full edit cycle, insert + rerender shows in outline

The e2e test simulates a full save/reload by cloning the root and re-constructing a `Project`.

## External deps

- `@monbolc/lowcode-types`, `@monbolc/lowcode-utils`, `@monbolc/lowcode-renderer-core`, `@monbolc/lowcode-react-renderer`, `@monbolc/lowcode-designer`, `@monbolc/lowcode-plugin-outline-pane` (workspace)
- `react-resizable-panels` (runtime) — **the only package that imports this**
- `react`, `react-dom` (optional peer)

## ⚠️ Known issues

### P1.1 — React 19 test warnings

`packages/editor-skeleton/tests/skeleton.test.tsx`:
- "Each child in a list should have a unique 'key' prop" — top-level render call
- "Attempted to synchronously unmount a root while React was already rendering" — same class of bug as the L2-D `plugin-outline-pane` `h()()` fix; the skeleton's view code likely needs a resolver pattern (`h()()` that re-reads the runtime on every call) to allow test React 19 injection via `adapter.setRuntime()` in `beforeAll`

## Missing from upstream port

- `Workbench` — tabbed UI for multiple editor views
- `Widget`/`Panel`/`Dock`/`DialogDock`/`Stage` — the widget primitives
- `PopupService` — singleton for drawer/popup management
- `createField` — field factory that picks `PopupField`/`EntryField`/`PlainField`/`Field` based on `type`
- The 9 `Area` types (`TopArea`, `LeftArea`, `MainArea`, etc.)

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — L4 design and inline-styles convention
- [../ROADMAP.md](../ROADMAP.md) — P1.1 (test warnings), P1.3 (wire plugin-setters), P2.3 (more widgets)
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — upstream is 54 files, 5,301 lines; sapu is 3 src files
- [`examples/hello-sapu.html`](../../examples/hello-sapu.html) — the real demo using the real `Skeleton`
