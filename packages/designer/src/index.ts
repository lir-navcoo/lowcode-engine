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
 */

export { DocumentModel } from './document';
export type { DocumentEvents, IDocumentModel } from './document';

export { Node } from './node';

export { Project } from './project';
export type { ProjectEvents } from './project';

export { Dragon } from './dragon';
export type { DragonEvents, DragonState, DropTarget, BoostMeta } from './dragon';

export { Simulator } from './simulator';
export type { SimulatorOptions } from './simulator';

export { BuiltinSimulatorHost } from './simulator-host';
export type { SimulatorHostOptions } from './simulator-host';

export { DragResizeEngine, computeResize } from './drag-resize';
export type { ResizeAnchor, DragResizeEngineOptions } from './drag-resize';

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
} from './dom';
export type { Rect, HitInfo } from './dom';
