# `@monbolc/lowcode-types` (L0)

> **Version**: 2.0.2 (uncommitted bump from 2.0.1; new fields added) · **React-free** · **Pure types** · **Zero runtime code**

## Purpose

The single source of truth for the engine's public type system. Every other package depends on this. It is pure types (no runtime code) so it can never break at runtime and re-publishes are cheap.

## Public exports (re-exported from `src/index.ts`)

### Primitives
- `ID` — identifier alias
- `Label` — string alias
- `JSONValue` — recursive JSON type
- `Unknown` — opaque `unknown`

### Node schema
- `IPublicTypeNodeSchema` — single node in the page tree
- `IPublicTypeNodeData` — discriminated union (4 variants: `literal | expression | binding | variable`)
- `IPublicTypeRootSchema` — extends `IPublicTypeNodeSchema`; adds `fileName, i18n, dataSources, meta`

### Components
- `IPublicTypeComponentSchema` — component metadata
- `IPublicTypeNestingRule` — `parentWhitelist, parentBlacklist, childWhitelist, childBlacklist, canBePageChild`
- `IPublicTypeComponentConfigure` — `props, style, events, advanced, slots`
- `IPublicTypeFieldConfig` — `name, title, description, setter, required, defaultValue, extraProps, condition, readOnly, group, order`
- `IPublicTypeSetterConfig` — `componentName + props`
- `IPublicTypeEventConfig` — `name, title, description, defaultAction, paramTypes`
- `IPublicTypeAdvancedConfig` — `condition / loop / staticEnabled` toggles
- `IPublicTypeSlotConfig` — `name, title, defaultSchema, isContainer, componentWhitelist`

### Actions & data
- `IPublicTypeActionContent` — `method | link | script | reload | dialog | custom`
- `IPublicTypeDataSource` — `id, title, handler, options, dataHandler, isInit, requestLifecycle`

### Engine API
- `IPublicEngineOptions` — `container, schema, components, theme, locale, designMode`
- `IPublicApiEngine` — `init / destroy / ready / get / peek`
- `IPublicApiDesigner` — `selection / isDragging / getNode / select / insert / remove / move / setProp / undo / redo`

### Styles & assets
- `IPublicTypeStyle`, `IPublicTypeBreakpoint`, `IPublicTypeResponsiveStyle`
- `IPublicTypeAsset` — `id, title, type (image|font|video|audio|icon|file), url, width, height, mimeType, hash`

### Project
- `IPublicTypeProjectSchema`, `IPublicTypeProjectConfig`
- `IPublicTypeComponentCategory`

### Utility types
- `IPublicTypeCallback<T>`, `IPublicTypeDisposable`, `IPublicTypeResult<T, E>`, `IPublicTypeClass<T>`

## Key types — 2-5 most important

```ts
interface IPublicTypeNodeSchema {
  componentName: string;
  props?: Record<string, JSONValue>;
  children?: IPublicTypeNodeSchema[];
  condition?: IPublicTypeNodeData;       // hide if expression is falsy
  loop?: IPublicTypeNodeData;            // bind item/index to render a list
  loopItemName?: string;                 // default "item"
  loopIndexName?: string;                // default "index"
  conditionGroup?: string;               // NEW in 2.0.2
  loopArgs?: [string, string];           // NEW in 2.0.2
  key?: string;                          // stable diffing key
  meta?: Record<string, Unknown>;
}

type IPublicTypeNodeData =
  | { type: 'literal'; value: JSONValue }
  | { type: 'expression'; value: string }
  | { type: 'binding'; value: string }
  | { type: 'variable'; value: string; mock?: JSONValue };  // NEW in 2.0.2
```

## Implementation patterns

- Pure types; **zero runtime code**
- Heavy JSDoc on every declaration
- `IPublicTypeNodeData` is a discriminated union by `type`; consumed via `isNodeData` guard (in `@monbolc/lowcode-utils`)
- `IPublicTypeClass<T>` deliberately returns `new (...args) => T` ctor (used as DI key in `editor-core`)

## Test coverage

- 1 file: `tests/types.test.ts` (2 tests)
  - regex-greps `src/index.ts` to confirm ≥30 expected type names are present (anti-regression)
  - constructs a `JSONValue` literal to force a typecheck

## External deps

- None (zero runtime deps)

## Notes

- **Uncommitted v2.0.2**: version bump 2.0.1 → 2.0.2 with new fields. Published to npm as 2.0.2 but local working tree has the bump uncommitted.
- v2.0.1 added: ESM `.js` extension fix.
- The upstream `ali-lowcode-engine/packages/types/` has 199+ public types; sapu is slimmed to what L0–L4 actually consumes. See [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) for the full list of dropped types.

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — L0/L1 design principles
- [../ROADMAP.md](../ROADMAP.md) — current P0 (commit the v2.0.2 bump)
