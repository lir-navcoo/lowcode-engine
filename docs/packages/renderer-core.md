# `@monbolc/lowcode-renderer-core` (L2)

> **Version**: 2.0.0 · **Framework-agnostic** · **React peer dep (optional)** · **6 tests**

## Purpose

The **React injection seam**. Defines `IRuntime` (a framework-agnostic slice of React primitives), the `adapter` singleton, and 6 concrete renderer class stubs that the React adapter replaces with real implementations.

This is the package that makes L0–L2 (and parts of L3) immune to React major version changes.

## Public exports

### Singleton
- `adapter` — process-wide `Adapter` instance; the seam

### Classes
- `BaseRenderer` — abstract base; has `props, state, __ref`, lifecycle stubs (`setState, forceUpdate, componentDidMount?, componentDidUpdate?, componentWillUnmount?, componentDidCatch?`), `__getRef` for ref capture
- 6 concrete renderer stubs: `PageRenderer`, `ComponentRenderer`, `BlockRenderer`, `AddonRenderer`, `TempRenderer`, `DivRenderer`
- 6 factory functions: `pageRendererFactory, componentRendererFactory, blockRendererFactory, addonRendererFactory, tempRendererFactory, divRendererFactory`
- `ensureRuntimeLoaded()` helper

### Types
- `IConfigProvider`
- `IRenderComponent`
- `IRendererModules` — `{ PageRenderer, ComponentRenderer, BlockRenderer, AddonRenderer, TempRenderer, DivRenderer? }`
- `IRendererProps` — `appHelper?, components?, designMode?, suspended?, schema, onCompGetRef?, onCompGetCtx?, thisRequiredInJSE?`
- `IRendererState` — `{ engineRenderError?, error? }`
- `IRuntime` — the framework slice

## Key types

```ts
interface IRuntime {
  Component: any;          // React.Component (or any class with setState/forceUpdate/render)
  PureComponent: any;
  createElement: any;     // (type, props?, ...children) => element
  createContext: any;
  forwardRef: any;
  findDOMNode?: any;      // optional; React 19 removed it
}
```

## Implementation patterns

- **Framework-agnostic via runtime injection**: `adapter.setRuntime(IRuntime)` validates required modules and stores them. Renderers access the framework primitives (`createElement` etc.) through `adapter.getRuntime()`.
- The 6 concrete renderers in this package are **stubs** that return `null` from `render()`. The real implementations live in `@monbolc/lowcode-react-renderer` and are pushed via `adapter.setRenderers(...)`.
- `adapter.pickRenderer(schema)` does a name-based lookup (`Page/Block/Addon/Temp/Div` map to their named renderer; everything else falls through to `ComponentRenderer`).
- `makeStubRuntime()` builds a no-op runtime for SSR / pre-React environments (Stub Component classes whose `setState/forceUpdate/render` are no-ops, `createElement: () => null`).
- `BaseRenderer` subclasses are NOT expected to inherit from the runtime's `Component` — they are plain objects; the React adapter wraps them.

## Test coverage

- 1 test file, 6 tests: `adapter.test.ts`
- stub runtime default, setRuntime validation, valid runtime accept, setRenderers round-trip, pickRenderer routing (Page/Block/Component/fallback), setConfigProvider round-trip

## External deps

- `@monbolc/lowcode-types` (workspace)
- `@monbolc/lowcode-utils` (workspace)
- `react`, `react-dom` are **peerDependencies (optional)** with explicit dev deps of `^19.2.7`
- `@types/react`, `@types/react-dom` (dev)

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — "React injection boundary" section
- [../packages/react-renderer.md](react-renderer.md) — the only consumer that calls `setRuntime`
