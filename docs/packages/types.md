# `@monbolc/lowcode-types` (L0)

> **Version**: 2.4.0 · **React-free** · **Pure types** · **Zero runtime code**

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

### Drag-and-drop surface (re-exported from `./drag`)
- `IPublicTypeNodeLike` — minimal `{ id, componentName, [key: string]: unknown }` shape
- `IPublicTypeBoostMeta` — palette → canvas payload (`componentName + initialProps`)
- `IPublicTypeDragObject` — discriminated union `Node | NodeData | Any`
- `IPublicTypeLocateEvent`, `IPublicTypeLocation`
- `IPublicTypeSensor<TNode>` — drop-target registration shape
- `IPublicModelDragon<TNode>` — generic public Dragon wrapper

### Location / Setting / Presentational / Workspace (2.4.0)

四个新文件从 ali v1.3.2 slim 端口过来,供 L2–L6 消费。**L0 纯类型层不引入 React 类型**;上游的 `ReactNode` / `ComponentType` 在 sapu 用 `unknown` 代替,消费方窄化。`IPublicTypeRect` 不在本包(已在 `@monbolc/lowcode-designer` 的 `simulator-host.ts` 定义,见 D.I2 阶段)。

- **Location**(`./location`)
  - `IPublicTypeLocationDetailType` — `enum { Children, Prop }`,拖放位置类别
  - `IPublicTypeLocationChildrenDetail` — `{ type, index?, valid?, edge?, near?, focus? }`,近邻节点用 `IPublicTypeNodeLike` 而非 `IPublicModelNode`
  - `IPublicTypeLocationPropDetail` — `{ type, name, domNode? }`
  - `IPublicTypeLocationDetail` — 上述两者的联合
  - `IPublicTypeLocationData<TNode>` — 拖放定位事件负载,`target` 用 `TNode` 泛型,`event: unknown`

- **Setting**(`./setting`)
  - `IPublicTypeCommandHandlerArgs` — `Record<string, unknown>`
  - `IPublicTypeCommandParameter` — `{ name, propType, description, defaultValue? }`(`propType` 在 sapu 简化为 `string`)
  - `IPublicTypeCommand` — `{ name, parameters?, description?, handler }`
  - `IPublicTypeHotkeyCallback` — `(e: KeyboardEvent, combo?) => unknown | false`
  - `IPublicTypeHotkeyCallbackConfig` — `{ callback, modifiers, action, seq?, level?, combo? }`

- **Presentational**(`./presentational`)
  - `IPublicTypeI18nData` — `{ type: 'i18n', intl?, [key: string]: unknown }`
  - `IPublicTypeIconConfig` — `{ type, size?, className? }`(size 可数字或预设字符串)
  - `IPublicTypeIconType` — `string | unknown | IPublicTypeIconConfig`(`unknown` 占位上游的 React 组件)
  - `IPublicTypeTitleConfig` — `{ label?, tip?, docUrl?, icon?, className? }`
  - `IPublicTypeTitleContent` — 字符串 / i18n / 节点 / 配置四选一

- **Workspace**(`./workspace`)
  - `IPublicTypeResourceType` — 资源工厂签名(`(ctx, options) => IPublicResourceTypeConfig`),含 `resourceName` + `resourceType` 字段
  - `IPublicResourceTypeConfig` — L0 薄壳:`description?, defaultTitle?, defaultViewName, editorViews`

### Simulator renderer surface (re-exported from `./simulator-renderer`)
- 内置模拟器渲染器契约(供 Phase D bem-tools / live-editing 消费)

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

- 2 files: `tests/types.test.ts` (4 tests), `tests/location-setting-presentational.test.ts` (12 tests)
  - 第一文件 regex-greps `src/index.ts` 确认 ≥30 个核心类型名都在(防回归)
  - 第一文件构造 `JSONValue` 字面量 + 拖放类型实例触发 typecheck
  - 第二文件覆盖 4 个新模块的导出 + 关键签名(enum / 联合 / 泛型 / 可调用签名)

## External deps

- None (zero runtime deps)

## Notes

- **Uncommitted v2.0.2**: version bump 2.0.1 → 2.0.2 with new fields. Published to npm as 2.0.2 but local working tree has the bump uncommitted.
- v2.0.1 added: ESM `.js` extension fix.
- The upstream `ali-lowcode-engine/packages/types/` has 199+ public types; sapu is slimmed to what L0–L4 actually consumes. See [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) for the full list of dropped types.

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — L0/L1 design principles
- [../ROADMAP.md](../ROADMAP.md) — current P0 (commit the v2.0.2 bump)
