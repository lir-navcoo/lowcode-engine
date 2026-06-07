# Comparison with `alibaba/lowcode-engine` v1.3.2

> Reference clone at `../ali-lowcode-engine/` (HEAD `f6305c228`). This document is the cross-reference for the rewrite.

## TL;DR

| Metric | `alibaba/lowcode-engine` v1.3.2 | `sapu-lowcode-engine` (rewrite) | Ratio |
|---|---:|---:|---:|
| Packages | 15 | 11 (L0–L4 + L2.5) | 0.73× |
| Source files (.ts/.tsx in `packages/*/src`) | 551 | ~50 | 0.09× |
| Lines of code | ~49,800 | ~6,000 (est.) | 0.12× |
| Class components | 104 | **0** | 0× |
| MobX usage | 55 `@observer` + 92 `@computed` + 3 `makeAutoObservable` | **0** (custom Emitter + useRev) | 0× |
| `@alifd/next` import sites | 14 (across 7 packages) | **0** | 0× |
| React major version | 16.x (peer `^16.4.1`–`^16.8.1`) | 19.2.7 | +3 majors |
| Build system | `@alib/build-scripts` (webpack 4) | `tsc` (per-package dual CJS+ESM) | — |
| Test framework | Jest 26 + enzyme 3 | Vitest 2.1 + @testing-library/react 16 | — |
| UI library | `@alifd/next` 1.x (Fusion) | BaseUI (`@base-ui-components/react` 1.x) | — |
| Splitter | `react-split-pane` (in editor-skeleton) | `react-resizable-panels` | — |
| Tree view | hand-rolled recursive `Tree`/`TreeNode` (in plugin-outline-pane) | `react-arborist` | — |

**Sapu is a deliberate slimming**: same conceptual architecture, ~10% of the code, with hard dependency upgrades (React 16→19, Fusion→BaseUI, MobX→none, webpack 4→tsc).

## Package-by-package mapping

### Direct 1:1 ports (or close to it)

| Upstream `ali-lowcode-engine` package | Sapu package | Status | Key differences |
|---|---|---|---|
| `packages/types` (182 files, 6,745 lines) | `@monbolc/lowcode-types` (1 file, ~600 lines) | ✅ direct port, slimmed | Dropped `deprecated/`, `@alilc/lowcode-datasource-types` re-export, asset/JSONValue/Type* family. Kept core schema types. |
| `packages/utils` (67 files, 2,458 lines) | `@monbolc/lowcode-utils` (7 files) | ✅ direct port, slimmed | Kept object/path/emitter/logger/guards/id. Dropped asset loader, cursor, app-helper, context-menu, lodash, mobx, `prop-types`, @alifd/next. |
| `packages/ignitor` (config-only, demo launcher) | `@monbolc/lowcode-ignitor` (1 file) | ⚠️ L0 placeholder only | Sapu ingitor is a `bootstrap(options)` function that injects a "ready" banner. The real composition root will live in the L7 `engine` package (not yet created). |
| `packages/plugin-command` (3 files, 564 lines) | `@monbolc/lowcode-plugin-command` (2 src files) | ✅ direct port | Pure logic, no React, no UI. Same undo/redo + auto-merge + shortcut parsing. |
| `packages/editor-core` (30 files, 3,227 lines) | `@monbolc/lowcode-editor-core` (4 src files) | ✅ direct port, slimmed | Kept `Editor`, `DIContainer`, `I18n`, `PluginManager`. Dropped `obx` MobX facade, `widgets/tip` + `widgets/title` (Fusion-based), `power-di` external dep (rolled own), `intl-messageformat`. |
| `packages/renderer-core` (22 files, 3,647 lines; `BaseRenderer` 1,050 lines) | `@monbolc/lowcode-renderer-core` (4 src files) | ✅ direct port, slimmed | Kept `adapter`, `BaseRenderer` (small, framework-agnostic), 6 renderer stubs, `IRuntime` contract. Dropped `JSExpression` evaluator, `DataSource`, `socket.io-client`, `fetch-jsonp`, `whatwg-fetch`, `prop-types`, `HOC leaf.tsx`. |
| `packages/react-renderer` (1 file, 66 lines) | `@monbolc/lowcode-react-renderer` (3 src files) | ✅ direct port, expanded | Kept `installReactRuntime` + 6 concrete renderers. **Added**: `uninstallReactRuntime`, `createReactRoot`, `setupReactRenderer`, `ReactRenderer` class. No more `@alifd/next` `ConfigProvider` import. No more `findDOMNode: ReactDOM.findDOMNode` (React 19 removed it; replaced with no-op). |
| `packages/designer` (86 files, 15,225 lines) | `@monbolc/lowcode-designer` (~10 src files) | ⚠️ partial port | Ported `DocumentModel`, `Node`, `Project`, `Dragon`, DOM utilities, 5 commands (Insert/Remove/Move/SetProp/Rename). **Not ported**: `SettingTopEntry`/`SettingField`, `BuiltinSimulator`, `LowCodePluginManager`, `BemToolsManager`, `Detecting`, `Scroller`, `Clipboard`, `ComponentMeta` parser, `LowCodePluginContext`. |
| `packages/editor-skeleton` (54 files, 5,301 lines) | `@monbolc/lowcode-editor-skeleton` (3 src files) | ⚠️ minimal port | Ported `Skeleton` (3-pane), `SettingsPanel`, `Overlays`. **Not ported**: `Workbench`, `Widget`/`Panel`/`Dock`/`DialogDock`/`Stage`, `PopupService`, `createField`, the 9 `Area` types. Settings panel uses its own minimal JSON-based editor (not wired to `plugin-setters` yet). |

### New in sapu (no upstream equivalent)

| Sapu package | Why it exists |
|---|---|
| `@monbolc/lowcode-plugin-setters` (L2.5) | The upstream gets default setters from the **external** package `@alilc/lowcode-engine-ext` (not vendored in the open-source repo). Sapu ships its own setters in-repo, using BaseUI peer-dep but currently plain DOM elements. |
| `@monbolc/lowcode-plugin-outline-pane` | The upstream has a hand-rolled recursive `Tree`/`TreeNode`. Sapu ports the data model (`OutlinePane`, `schemaToTreeNodes`) but uses `react-arborist` for rendering. |

### Upstream packages NOT yet in sapu (planned for L5+)

| Upstream package | What it does | Sapu plan |
|---|---|---|
| `packages/engine` (15 files, 1,330 lines) | Composition root: `init()`/`destroy()`, registers all inner plugins, UMD bundles. | Will become `@monbolc/lowcode-engine` (L7). Not started. |
| `packages/shell` (45 files, 5,155 lines) | The `IPublicApi*` / `IPublicModel*` facade layer. Re-exports 28 `@alifd/next` components as `IPublicApiCommonUI`. | Will become `@monbolc/lowcode-shell` (L6). The 28-component re-export is **dropped** (those Fusion components are being removed entirely). |
| `packages/workspace` (13 files, 1,298 lines) | Multi-window / multi-view support. | Will become `@monbolc/lowcode-workspace` (L5). Sapu may collapse to single-view. |
| `packages/plugin-designer` (1 file, 157 lines) | The "designer" widget glue file (renders `<DesignerView>` in mainArea). | L4 work; partially folded into `editor-skeleton`. |
| `packages/react-simulator-renderer` (13 files, 1,609 lines) | The simulator iframe host. Uses `getReactInternalFiber` to find DOM nodes (fragile React 16 internals). | Will be a L4+ package; **must** drop `getReactInternalFiber` (React 19 has different internals). Will likely be a L5 package after skeleton is fully wired. |

## Class components, decorators, MobX

### Upstream class components (104 total)

By package:
- `editor-skeleton` 40
- `designer` 22
- `plugin-outline-pane` 14
- `renderer-core` 8
- `react-simulator-renderer` 6
- `editor-core` 4
- `workspace` 4
- `utils` 2
- `plugin-designer` 1
- `shell` 3

Almost all are decorated with `@observer` (mobx-react). Heavy use of `componentWillUnmount` and `componentWillMount` (React 16 lifecycle).

**Sapu has zero class components.** Verified by reading every `src/` file in every package. Every React-rendering file uses a `const h = () => adapter.getRuntime().createElement` resolver + manual `props`/`state`/`setState`/`forceUpdate` objects.

### MobX

Upstream has 55 `@observer` + 92 `@computed` + 3 `makeAutoObservable`. All imports go through the `obx` facade in `editor-core/utils/obx.ts`:
```ts
// upstream ali
import { observable, observe, autorun, makeObservable, makeAutoObservable, reaction, computed, action, runInAction, untracked, observer } from './obx';
```
`obx.ts` does `configure({ enforceActions: 'never' })` — MobX is configured permissively throughout.

**Sapu has zero MobX.** All event-driven reactivity goes through:
- `@monbolc/lowcode-utils` `Emitter` class for pub/sub
- `useRev` hook (a `useState(0)` counter bumped on every event) in components that need to re-render

Decision (2026-06-07): defer reactivity choice. When the time comes, **Valtio** is the leading candidate (lighter than MobX, no decorator coupling, plays well with React 19's `useSyncExternalStore`).

## `@alifd/next` → BaseUI migration

Upstream has 14 `@alifd/next` import sites across 7 packages. **Sapu has zero.**

Full list of upstream sites to migrate (in M4-rev for the ali clone; already done in sapu):

| File | Components imported | Sapu replacement |
|---|---|---|
| `packages/editor-skeleton/src/components/popup/index.tsx` | `Drawer, ConfigProvider` | BaseUI `Dialog`/`Sheet` + `ThemeProvider` |
| `packages/editor-skeleton/src/components/field/fields.tsx` | `Icon` | BaseUI `Icon` or external `lucide-react` |
| `packages/editor-skeleton/src/components/widget-views/panel-operation-row.tsx` | `Button, Icon` | BaseUI `Button` |
| `packages/editor-skeleton/src/skeleton.ts` | `Divider` | BaseUI `Separator` |
| `packages/editor-skeleton/src/components/settings/settings-primary-pane.tsx` | `Tab, Breadcrumb` | BaseUI `Tabs` + custom breadcrumb |
| `packages/plugin-outline-pane/src/views/pane.tsx` | `Loading` | BaseUI `Spinner` |
| `packages/plugin-outline-pane/src/views/filter.tsx` | `Search, Checkbox, Balloon, Divider` | BaseUI `Search`, `Checkbox`, `Popover`, `Separator` |
| `packages/utils/src/create-icon.tsx` | `Icon` | BaseUI `Icon` |
| `packages/utils/src/context-menu.tsx` | `Menu, Icon` | BaseUI `Menu` |
| `packages/designer/src/context-menu-actions.ts` | `Menu` | BaseUI `Menu` |
| `packages/designer/src/builtin-simulator/node-selector/index.tsx` | `Overlay` | BaseUI `Popover` |
| `packages/engine/src/inner-plugins/default-context-menu.ts` | `Message` | Custom toast |
| `packages/react-renderer/src/index.ts` | `ConfigProvider` (subpath) | None — React adapter installs ThemeProvider if needed |
| `packages/types/src/shell/api/commonUI.ts` | bulk 28 components + `IconProps` | **Dropped entirely** in sapu |
| `packages/shell/src/api/commonUI.tsx` | bulk 28 components + `IconProps` | **Dropped entirely** in sapu |

**The 28-component `IPublicApiCommonUI`** (`Balloon, Breadcrumb, Button, Card, Checkbox, DatePicker, Dialog, Dropdown, Form, Icon, Input, Loading, Message, Overlay, Pagination, Radio, Search, Select, SplitButton, Step, Switch, Tab, Table, Tree, TreeSelect, Upload, Divider`) is the second-largest migration target in the upstream. **Sapu has decided to drop it** instead of re-implementing — plugin authors who need those components should use BaseUI directly or import their own.

## React 16 → 19 differences

### Patterns in upstream that don't exist in React 19

- **`findDOMNode`** in 1 file: `packages/renderer-core/src/renderer/renderer.tsx` (line 12 + 68)
- **`ReactDOM.render`** in 3 files: `plugin-designer/src/index.tsx`, `workspace/src/layouts/workbench.tsx`, `react-simulator-renderer/src/renderer-view.tsx`
- **`PropTypes`** in 1 file: `packages/renderer-core/src/components/VisualDom/index.tsx`
- **No `stringRef`, no `componentWill*`** in upstream either.

- **`getReactInternalFiber` / `reactFindDOMNodes`** in `react-simulator-renderer/src/utils/` reach into React 16's `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED` to walk the fiber tree. **Removed in sapu** — replaced with public React refs.

### Sapu's React 19 patterns

- **`createRoot` from `react-dom/client`** (used in `react-renderer` and `editor-skeleton` for imperative rendering).
- **`useSyncExternalStore`** is the planned reactivity primitive (not yet used; will replace `useRev` once Valtio or similar is chosen).
- **React 19.2.7 peerDep** in all L3+ packages (optional).
- **No `findDOMNode`** — the adapter's `IRuntime.findDOMNode` is `any` and optional; the React adapter provides a no-op stub.

## Type system differences

### Sapu has these (not in upstream)

- `IPublicTypeClass<T>` — used as DI key (`new (...args) => T` ctor).
- `IPublicTypeCallback<T>` — generic callback.
- `IPublicTypeDisposable` — disposal pattern.
- `IPublicTypeResult<T, E>` — `Result`-like type for fallible operations.
- `IPublicTypeI18nMessage` — i18n message shape (slim: `{ default, byLocale? }`).

### Sapu dropped these (in upstream)

All 199+ upstream `IPublic*` types that are part of the `shell/api` (cabin), `shell/model` (facade), and `shell/type` (legacy) layers — these are L6 shell work. Examples: `IPublicApiCommonDesignerCabin`, `IPublicModelSettingTopEntry`, `IPublicTypePanelDockConfig`, `IPublicTypeLiveTextEditingConfig`, `IPublicTypeSimulatorRenderer`, `IPublicTypeSnippet`, `IPublicTypeHelpTipConfig`, `IPublicTypeTipConfig`, `IPublicTypeComponentDescription`, `IPublicTypeJSFunction`, `IPublicTypeI18nData`, `IPublicTypeFilterItem`, `IPublicTypeComponentAction`, `IPublicTypeAdvanced`, `IPublicTypeCallbacks`, `IPublicTypeAutorunItem`, `IPublicTypeAppConfig`, `IPublicTypeExternalUtils`, `IPublicTypeInternalUtils`, `IPublicTypeComponentSort`, `IPublicTypeFieldExtraProps`, `IPublicTypeInitialItem`, `IPublicTypeDragNodeDataObject`, `IPublicTypeDragAnyObject`, `IPublicTypeDOMText`, `IPublicTypePropsList`, `IPublicTypePropsMap`, `IPublicTypeComponentMap`, `IPublicTypeComponentsMap`, `IPublicTypeUtilItem`, `IPublicTypeUtilsMap`, `IPublicTypeLowCodeComponent`, `IPublicTypeProCodeComponent`, `IPublicTypeSetterConfig`, `IPublicTypeSetterType`, `IPublicTypeRegisteredSetter`, `IPublicTypeCustomView`, `IPublicTypeDynamicSetter`, `IPublicTypeContextMenuAction`, `IPublicTypeHotkeyCallbackConfig`, `IPublicTypeHotkeyCallback`, `IPublicTypeHotkeyCallbacks`, `IPublicTypeCommand`, `IPublicTypeCommandHandlerArgs`, `IPublicTypeCommandParameter`, `IPublicTypeListCommand`, `IPublicTypePanelConfigProps`, `IPublicTypeTransformedComponentMetadata`, `IPublicTypeNestingFilter`, `IPublicTypeIconConfig`, `IPublicTypeIconType`, `IPublicTypeTitleConfig`, `IPublicTypeTitleContent`, `IPublicTypeTitleProps`, `IPublicTypeLocationData`, `IPublicTypeLocationDetail`, `IPublicTypeLocationChildrenDetail`, `IPublicTypeLocationDetailType`, `IPublicTypeLocationPropDetail`, `IPublicTypeOnChangeOptions`, `IPublicTypePropChangeOptions`, `IPublicTypeSetValueOptions`, `IPublicTypeMetadataTransducer`, `IPublicTypePropsTransducer`, `IPublicTypeConfigTransducer`, `IPublicTypeResourceType`, `IPublicTypeResourceList`, `IPublicTypeResourceData`, `IPublicTypeResourceTypeConfig`, `IPublicTypePreferenceValueType`, `IPublicTypeReference`, `IPublicTypeRequiredType`, `IPublicTypePropType`, `IPublicTypeBasicType`, `IPublicTypeOneOf`, `IPublicTypeOneOfType`, `IPublicTypeArrayOf`, `IPublicTypeObjectOf`, `IPublicTypeShape`, `IPublicTypeInstanceOf`, `IPublicTypeExact`, `IPublicTypeCompositeValue`, `IPublicTypeCompositeObject`, `IPublicTypeCompositeArray`, `IPublicTypeComplexType`, `IPublicTypeNodeDataType`, `IPublicTypeNodeInstance`, `IPublicTypePackage`, `IPublicTypeNpmInfo`, `IPublicTypeScrollable`, `IPublicTypePlugin`, `IPublicTypePluginCreater`, `IPublicTypePluginMeta`, `IPublicTypePluginConfig`, `IPublicTypePluginDeclaration`, `IPublicTypePluginDeclarationProperty`, `IPublicTypePluginRegisterOptions`, `IPublicTypeSkeletonConfig`, `IPublicTypeWidgetConfigArea`, `IPublicTypeWidgetBaseConfig`, `IPublicTypeConfigTransducer`, `IPublicTypeHooksConfig`, `IPublicTypeJSONValue`, `IPublicTypeJSONObject`, `IPublicTypeJSONArray`, all 7 `IPublicEnum*` enums, `EditorConfig`, `ThemeConfig`, `FusionTheme`, `PluginsConfig`, `PluginConfig`, `UtilsConfig`, `ConstantsConfig`, `LifeCyclesConfig`, `I18nConfig`, `HookConfig`, `AssetType`, `AssetLevel`, `AssetLevels`, `IPublicModelSimulatorRender`, `IPublicModelScrollTarget`, `IPublicModelSensor`, `IPublicModelSettingPropEntry`, `IPublicModelSettingTarget`, `IPublicModelEditorView`, `IPublicModelEngineConfig`, `IPublicModelExclusiveGroup`, `IPublicModelModalNodesManager`, `IPublicModelLocateEvent`, `IPublicModelDragObject`, `IPublicModelDropLocation`, `IPublicModelActiveTracker`, `IPublicModelClipboard`, `IPublicTypeAssetsJson`, `IPublicResourceData`, `IPublicResourceList`, `IPublicResourceTypeConfig`, `IPublicApiCommonDesignerCabin`, `IPublicApiCommonEditorCabin`, `IPublicApiCommonSkeletonCabin`, `IPublicApiCommonUtils`, and the entire `deprecated/` folder.

Sapu can add these back as needed; for now, the slimmed type set is what the L0–L4 code actually consumes.

## What the rewrite intentionally keeps

- **Schema shape**: `IPublicTypeNodeSchema` (componentName, props, children, condition, loop, key) is the same. Sapu adds `conditionGroup` and `loopArgs` to it (v2.0.2, uncommitted).
- **Document/Project model**: `DocumentModel` + `Project` + `Dragon` are the same shape.
- **Command pattern + undo/redo**: identical API.
- **Plugin context + DI**: same `IPluginContext` shape; sapu rolls its own `DIContainer` instead of `power-di`.
- **Renderer abstraction**: `IRuntime` is the same idea as the upstream; sapu uses `any`-typed fields throughout to stay framework-agnostic.

## What the rewrite intentionally drops

- All 28 `@alifd/next` re-exports via `IPublicApiCommonUI`
- All class components (104 in upstream → 0 in sapu)
- All MobX usage
- All `prop-types`
- All `findDOMNode` / `ReactDOM.render` / `getReactInternalFiber`
- `socket.io-client`, `fetch-jsonp`, `whatwg-fetch`
- `AppHelper` singleton
- `BemTools`
- `medium-editor` (devDep only)
- The `deprecated/` types folder
- Multi-window `Workspace` (deferred to L5+)
- The `engine-ext` external setter provider (sapu's `plugin-setters` is in-repo)
- UMD bundles
- `@alib/build-scripts` + webpack 4
- Enzyme + `enzyme-adapter-react-16`
- `lodash` (sapu's `utils` is small enough to not need it)
