# `@monbolc/lowcode-react-renderer` (L3)

> **Version**: 2.0.1 · **Imports React** · **The React injection boundary** · **10 tests**

## Purpose

The only package in the repo that actually `import`s React. It builds the `IRuntime` object from React 19.2.7, registers it on the adapter, and provides 6 concrete renderer classes that replace the stubs in `renderer-core`.

This is the package that "knows" about React. Every other L3+ package uses the `adapter.getRuntime().createElement` resolver instead.

## Public exports

### Functions
- `installReactRuntime()` — idempotent; builds the `IRuntime` from React 19.2.7 and calls `adapter.setRuntime(...)`
- `isReactRuntimeInstalled()` — returns the `_installed` boolean
- `uninstallReactRuntime()` — resets `_installed = false` and calls `adapter.initRuntime()` to put the stub back
- `createReactRoot(container)` — helper for imperative rendering
- `setupReactRenderer()` — `@internal` / **deprecated in 2.2.0** (will be removed in 3.0.0). One-shot bootstrap that wraps `installReactRuntime` + `adapter.setRenderers(createReactRenderers())`. L7 `init()` calls it for you. Direct callers should prefer the two explicit steps so each is visible.

### Classes
- `ReactRenderer` — wraps `IRendererProps`; uses `adapter.pickRenderer(schema)` to pick the right concrete renderer; on `render()` instantiates the renderer class and calls `render()`
- 6 internal concrete classes: `PageRendererImpl, ComponentRendererImpl, BlockRendererImpl, AddonRendererImpl, TempRendererImpl, DivRendererImpl`

### Type re-exports
- `IRenderComponent`, `IRendererProps` from `@monbolc/lowcode-renderer-core`

## Key types

```ts
class ReactRenderer {
  constructor(props: IRendererProps);
  render(): ReactNode;  // or whatever the runtime's createElement returns
}
```

## Implementation patterns

- **The only package that imports React directly** (and `react-dom/client`)
- `installReactRuntime` builds the `IRuntime` object with `Component, PureComponent, createElement, createContext, forwardRef` from React 19.2.7, and a no-op `findDOMNode` for back-compat (React 19 removed it)
- `_installed` is a module-level boolean; calling `installReactRuntime` twice is a no-op (same singleton)
- `createReactRenderers()` returns the 6 concrete classes. Each is a plain class with `props / state / setState / forceUpdate / render` — **not** extending `React.Component` (they're resolved at runtime through the adapter)
- **`h()()` resolver** in `renderers.tsx`: `const h = () => adapter.getRuntime().createElement as ...` — same pattern as `plugin-outline-pane`
- `renderNode` walks the schema tree; if the component name is in `props.components`, it instantiates that; otherwise it renders a placeholder `<div data-unknown-component="...">` with the original children inside (so the page is still navigable)
- Stable React keys: each child uses `child.key ?? rendered.key ?? '__idx_<i>'` fallback
- The 6 concrete renderers wrap their body in `<div data-renderer="Page">` (or `Block`, `Addon`, `Temp`, `Div`). These attributes are used by the editor-skeleton tests to find rendered nodes

## Test coverage

- 2 test files, 10 tests
- `inject.test.ts` (4): install, idempotency, uninstall, createReactRoot round-trip
- `render.test.ts` (6): installs React runtime, registers 6 renderers, pickRenderer routing, renders a Page schema, renders nested children with placeholder, uses user components, suspended=true renders empty, null for non-node, stable keys

## External deps

- `@monbolc/lowcode-types`, `@monbolc/lowcode-utils`, `@monbolc/lowcode-renderer-core` (workspace)
- `react`, `react-dom` (optional peer)
- `react`, `react-dom`, `@types/react`, `@types/react-dom` (dev)

## Notable differences from upstream

- **No more `@alifd/next` `ConfigProvider`** — the React adapter installs its own `ThemeProvider` if needed
- **No more `findDOMNode: ReactDOM.findDOMNode`** — React 19 removed it; replaced with a no-op stub
- **Added `uninstallReactRuntime` and `createReactRoot`** for testability and imperative-render use cases

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — "React injection boundary" section
- [../packages/renderer-core.md](renderer-core.md) — what gets replaced
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — upstream is 1 file, 66 lines; sapu expanded to 3 src files
