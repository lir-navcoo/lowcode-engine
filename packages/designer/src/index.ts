/**
 * @monbolc/lowcode-designer — barrel export
 *
 * SapuLowcodeEngine L3 designer. Provides:
 *   - DocumentModel: schema tree with mutation API
 *   - Node: ergonomic wrapper around a single schema node
 *   - Project: top-level container (document + selection + dragon)
 *   - Dragon: drag state machine
 *   - Simulator: preview wrapper around the schema
 *   - DocumentCommands: undo/redo-ready ICommand wrappers
 *   - DOM utilities: rect math, id tagging, hit testing
 *   - Phase B ali-mirror: misc/invariant helpers, DOM clipboard
 *     bridge, Detecting hover tracker, OffsetObserver, clickable
 *     walker, path utils, parse-metadata helper
 */

export { DocumentModel } from './document';
export type { DocumentEvents, IDocumentModel, IDocumentModelHost } from './document';
export { Selection } from './selection';
export { History, Session } from './history';
export type { Serialization, IDisposable } from './history';
export { HistoryState } from './history';
export { ComponentMetaLite, ComponentMetaRegistry } from './component-meta';
export type {
  IComponentMetaLite,
  IComponentMetaAdvanced,
  IComponentMetaNpmInfo,
  IComponentMetaI18nData,
  ILiveTextEditingConfig,
  IActionContent,
} from './component-meta';

export { Node } from './node';

export { Project } from './project';
export type { ProjectEvents } from './project';

export { Dragon } from './dragon';
export type { DragonEvents, DragonState, DropTarget, BoostMeta } from './dragon';

export { Simulator } from './simulator';
export type { SimulatorOptions } from './simulator';

export { BuiltinSimulatorHost } from './simulator-host';
export type {
  SimulatorHostOptions,
  IPublicTypeComponentInstance,
  IPublicTypeRect,
  ComponentMoveHooks,
} from './simulator-host';

export { DragResizeEngine, computeResize } from './drag-resize';
export type { ResizeAnchor, DragResizeEngineOptions } from './drag-resize';

export { ActiveTracker } from './active-tracker';
export type { ActiveTrackerEvents } from './active-tracker';

export {
  InsertCommand,
  RemoveCommand,
  MoveCommand,
  SetPropCommand,
  RenameCommand,
  DetectingCommand,
  ScrollerCommand,
  ClipboardCommand,
} from './commands';
export type { ScrollBlock, ClipboardOp, ClipboardPayload } from './commands';

export {
  getRect,
  rectsOverlap,
  rectContains,
  rectMidpoint,
  findNodeIdFromElement,
  tagElementWithNodeId,
  hitTest,
  getHitInfo,
  findDOMNodes,
  instanceToElement,
} from './dom';
export type { Rect, HitInfo, InstanceLike } from './dom';

// ---- locate.ts axis helpers (Phase C.Z) ----
export { isRowContainer, isChildInline, isVerticalContainer, isVertical } from './locate';

// ---- Phase B ali-mirror (slim pure-helper port) ----

export { invariant } from './utils/invariant';
export { isElementNode, isDOMNodeVisible, normalizeTriggers } from './utils/misc';
export { getClosestNode, type TreeNodeLike } from './utils/tree-walk';

export { Clipboard, clipboard as domClipboard } from './designer/clipboard';
export type { DomClipboardPayload, ClipboardEvents } from './designer/clipboard';

export { Detecting } from './designer/detecting';
export type { DetectingEvents } from './designer/detecting';

export { OffsetObserver, createOffsetObserver } from './designer/offset-observer';
export type { OffsetObserverEvents, IViewportLite, NodeInstanceRef } from './designer/offset-observer';

export { getClosestClickableNode } from './builtin-simulator/utils/clickable';
export {
  isPackagePath,
  toTitleCase,
  generateComponentName,
  getNormalizedImportPath,
  makeRelativePath,
  resolveAbsoluatePath,
  joinPath,
  removeVersion,
} from './builtin-simulator/utils/path';
export {
  primitiveTypes,
  parseProps,
  parseMetadata,
  type PropConfig,
} from './builtin-simulator/utils/parse-metadata';

// ---- Phase D.S1 ali-mirror (setting tree — pure helpers) ----
export { Transducer } from './designer/setting/utils';
export type {
  ISettingEntry,
  ISettingField as ISettingFieldSeed,
  IPublicApiSetters,
  IPublicModelEditor,
} from './designer/setting/setting-entry-type';

// ---- Phase D.S2 ali-mirror (setting tree — SettingPropEntry base class) ----
export {
  SettingPropEntry,
  SETTING_NODE_PROP_CHANGE,
} from './designer/setting/setting-prop-entry';
export type {
  ISettingPropEntry,
  IPropEntryParent,
  IPublicTypeFieldExtraProps,
  IPublicTypeSetValueOptions,
} from './designer/setting/setting-prop-entry';

// ---- Phase D.S3 ali-mirror (setting tree — SettingField extends SettingPropEntry) ----
export { SettingField, isSettingField } from './designer/setting/setting-field';
export type {
  ISettingField,
  IPublicTypeFieldConfig,
  IPublicTypeCustomView,
  IPublicTypeSetterType,
  IPublicTypeDynamicSetter,
  IPublicTypeDisposable,
} from './designer/setting/setting-field';

// ---- Phase D.S4 ali-mirror (setting tree — SettingTopEntry, the canonical entry point) ----
export { SettingTopEntry } from './designer/setting/setting-top-entry';
export type {
  ISettingTopEntry,
  IComponentMetaTopEntry,
  ITopEntryNode,
  ITopEntryEditor,
} from './designer/setting/setting-top-entry';

// ---- Phase D.I2 ali-mirror (infra: observerHOC + bem-tools manager + simulator context + renderer) ----
export { observerHOC, useObserved } from './observer-hoc';
export { BemToolsManager } from './builtin-simulator/bem-tools/manager';
export type { BemToolsData } from './builtin-simulator/bem-tools/manager';
export { SimulatorContext } from './builtin-simulator/context';
export { isSimulatorRenderer } from './builtin-simulator/renderer';
export type { BuiltinSimulatorRenderer } from './builtin-simulator/renderer';

// ---- Phase D.I3 ali-mirror (simulator resource-consumer, the autorun bridge) ----
export { ResourceConsumer } from './builtin-simulator/resource-consumer';
export type { MasterProvider, RendererConsumer } from './builtin-simulator/resource-consumer';

// ---- Phase D.I6 ali-mirror (bem-tools root + host-view + BorderDetecting + shims) ----
export { BemTools } from './builtin-simulator/bem-tools';
export { BorderDetecting, BorderDetectingInstance } from './builtin-simulator/bem-tools/border-detecting';
export { BorderSelecting } from './builtin-simulator/bem-tools/border-selecting';
export { BorderResizing } from './builtin-simulator/bem-tools/border-resizing';
export { BorderContainer } from './builtin-simulator/bem-tools/border-container';
export { InsertionView } from './builtin-simulator/bem-tools/insertion';
export { NodeSelector } from './builtin-simulator/bem-tools/node-selector-stub';
export { BuiltinSimulatorHostView } from './builtin-simulator/host-view';
export { engineConfig } from './utils/engine-config';
export { intl, globalLocale } from './utils/locale';
export { Title } from './components/title';
export type { ITitleProps } from './components/title';
export type { BemToolsProps } from './builtin-simulator/bem-tools';

// ---- Phase D.I8 ali-mirror (live-editing + drag-ghost) ----
export { LiveEditing } from './builtin-simulator/live-editing/live-editing';
export type { EditingTarget, SpecificRule, SaveHandler } from './builtin-simulator/live-editing/live-editing';
export { DragGhost, default as DragGhostDefault } from './designer/drag-ghost';
export type { DragGhostProps } from './designer/drag-ghost';
export type { BorderDetectingProps, BorderDetectingInstanceProps } from './builtin-simulator/bem-tools/border-detecting';
