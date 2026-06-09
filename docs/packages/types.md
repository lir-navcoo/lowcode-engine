# `@monbolc/lowcode-types` (L0)

> **Version**: 2.5.0 · **React-free** · **Pure types** · **Zero runtime code**

## Purpose

`@monbolc/lowcode-types` 是引擎公共类型系统的 L0 包。它只导出类型和 enum，不引入 React，不依赖运行时包，供插件作者、物料作者和上层包共享契约。

## Public exports

### Primitive / schema core

- `ID`, `Label`, `JSONValue`, `Unknown`
- `IPublicTypeNodeSchema`, `IPublicTypeNodeData`, `IPublicTypeRootSchema`
- `IPublicTypeComponentSchema`, `IPublicTypeNestingRule`, `IPublicTypeComponentConfigure`
- `IPublicTypeFieldConfig`, `IPublicTypeSetterConfig`, `IPublicTypeEventConfig`, `IPublicTypeAdvancedConfig`, `IPublicTypeSlotConfig`
- `IPublicTypeDataSource`, `IPublicTypeI18nMessage`
- `IPublicTypeProjectConfig`, `IPublicTypeComponentCategory`

### 2.4.0 public surface

- `location.ts`: `IPublicTypeLocationDetailType`, `IPublicTypeLocationChildrenDetail`, `IPublicTypeLocationPropDetail`, `IPublicTypeLocationDetail`, `IPublicTypeLocationData<TNode>`
- `setting.ts`: `IPublicTypeCommandHandlerArgs`, `IPublicTypeCommandParameter`, `IPublicTypeCommand`, `IPublicTypeHotkeyCallback`, `IPublicTypeHotkeyCallbackConfig`
- `presentational.ts`: `IPublicTypeI18nData`, `IPublicTypeIconConfig`, `IPublicTypeIconType`, `IPublicTypeTitleConfig`, `IPublicTypeTitleContent`
- `workspace.ts`: `IPublicTypeResourceType`, `IPublicResourceTypeConfig`
- `simulator-renderer.ts`: simulator renderer contract
- `drag.ts`: `IPublicTypeNodeLike`, `IPublicTypeBoostMeta`, `IPublicTypeDragObject`, `IPublicTypeLocateEvent`, `IPublicTypeLocation`, `IPublicTypeSensor<TNode>`, `IPublicModelDragon<TNode>`

### 2.5.0 Ali-compatible slim ports

本轮 T2.1–T2.7 按 AliLowcodeEngine v1.3.2 能力 gap 补齐插件/物料作者最常用的 `IPublicType*` 类型名，但保持 sapu 的 L0 原则：不引入 React 类型、不引入 shell/model proxy zoo、不做弃用兼容层。

- `component-meta.ts`
  - `IPublicTypeComponentInstance`
  - `IPublicTypeComponentMetadata`
  - `IPublicTypeComponentDescription`
  - `IPublicTypeRemoteComponentDescription`
  - `IPublicTypeComponentAction`
  - `IPublicTypeComponentSort`
- `js-block.ts`
  - `IPublicTypeJSExpression`
  - `IPublicTypeJSFunction`
  - `IPublicTypeJSBlock`
  - `IPublicTypeJSSlot`
  - `IPublicTypeJSONValue`, `IPublicTypeJSONObject`, `IPublicTypeJSONArray`
  - `IPublicTypeCompositeValue`, `IPublicTypeCompositeObject`, `IPublicTypeCompositeArray`
- `plugin.ts`
  - `IPublicTypePluginConfig`
  - `IPublicTypePluginMeta`
  - `IPublicTypePluginDeclarationProperty`
  - `IPublicTypePluginDeclaration`
  - `IPublicTypePluginRegisterOptions`
  - `IPublicTypePluginCreater`
  - `IPublicTypePlugin`
- `enum.ts`
  - `IPublicEnumContextMenuType`
  - `IPublicEnumDragObjectType`
  - `IPublicEnumEventNames`
  - `IPublicEnumPluginRegisterLevel`
  - `IPublicEnumPropValueChangedType`
  - `IPublicEnumTransformStage`
  - `IPublicEnumTransitionType`
- `field-config.ts`
  - `IPublicTypeSetterType`
  - `IPublicTypeDynamicSetter`
  - `IPublicTypeRegisteredSetter`
  - `IPublicTypePropConfig`
  - `IPublicTypePropType`
  - `IPublicTypePropTypes`
  - `IPublicTypeFieldExtraProps`
- `transducer.ts`
  - `IPublicTypeAdvanced`
  - `IPublicTypeConfigure`
  - `IPublicTypeSkeletonConfig`
  - `IPublicTypeConfigTransducer`
  - `IPublicTypeMetadataTransducer`
  - `IPublicTypePropsTransducer`
- `schema.ts`
  - `IPublicTypePageSchema`
  - `IPublicTypeBlockSchema`
  - `IPublicTypeContainerSchema`
  - `IPublicTypeSlotSchema`
  - `IPublicTypeNpmInfo`
  - `IPublicTypePackage`
  - `IPublicTypeSnippet`
  - `IPublicTypeProjectDocument`
  - `IPublicTypeProjectSchema`
- `action.ts`
  - `IPublicTypeActionContentObject`
- `editor.ts`
  - `IPublicTypeEditorViewConfig`
  - `IPublicTypeEditorView`
  - `IPublicTypeEditorValueKey`
  - `IPublicTypeEditorGetOptions`
  - `IPublicTypeEditorGetResult<T>`
  - `IPublicTypeEditorRegisterOptions`
  - `IPublicTypeEditor`

## Naming decision: project schema

此前 sapu 的 `IPublicTypeProjectSchema` 是薄项目文档类型。Ali 的 `IPublicTypeProjectSchema` 是 rich schema，包含 `componentsMap`, `componentsTree`, `i18n`, `utils`, `constants`, `css`, `dataSource`, `config`, `meta`。

2.5.0 起采用以下命名：

- `IPublicTypeProjectSchema`：Ali-compatible rich schema。
- `IPublicTypeProjectDocument`：sapu 当前项目文档类型。
- `IPublicTypeLegacyProjectDocument`：原 `src/index.ts` 里的旧薄项目文档类型，保留给内部迁移识别。

## Implementation constraints

- L0 包不 import React。上游的 `ReactNode` / `ComponentType` / 实例对象在这里用 `unknown`, `Element | object` 或消费方窄化。
- 不导出 Ali 的 `shell/api/*` 和 `shell/model/*` proxy zoo。sapu 的插件上下文继续走真类或真实引用。
- 类型补齐优先保证插件/物料 authoring 编译面，不把 Ali 的旧运行时结构搬进 sapu。

## Test coverage

- `tests/types.test.ts` 扫描 `src/*.ts`，检查核心 `export type` / `export interface` / `export enum` 类型名未丢失。
- `tests/types.test.ts` 继续覆盖 `JSONValue`, drag public surface, `IPublicModelDragon<TNode>` 泛型编译面。
- `tests/location-setting-presentational.test.ts` 覆盖 location / setting / presentational / workspace 关键签名。

## Current validation status

- `yarn typecheck`: 已通过，全部包 0 errors。
- `yarn test`: 本轮全量测试尚未收口。最近一次全量运行在 Node.js v24.15.0 下以 `MODULE_NOT_FOUND` 退出，尾部没有暴露具体缺失模块路径；接手人下一步应先重跑全量或定向 vitest 获取完整堆栈。

## External deps

- None。包内没有 runtime dependencies。

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md)
- [../ROADMAP.md](../ROADMAP.md)
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md)
- [../HANDOVER.md](../HANDOVER.md)
