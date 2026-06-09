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
  IComponentMetaLite,
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
