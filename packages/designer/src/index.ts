/**
 * @monbolc/lowcode-designer — barrel export
 *
 * SapuLowcodeEngine L3 designer. Provides:
 *   - DocumentModel: schema tree with mutation API
 *   - Node: ergonomic wrapper around a single schema node
 *   - Project: top-level container (document + selection + dragon)
 *   - Dragon: drag state machine
 *   - Simulator: preview wrapper around the schema
 *   - DOM utilities: rect math, id tagging, hit testing
 */

export { DocumentModel } from './document';
export type { DocumentEvents, IDocumentModel } from './document';

export { Node } from './node';

export { Project } from './project';
export type { ProjectEvents } from './project';

export { Dragon } from './dragon';
export type { DragonEvents, DragonState, DropTarget } from './dragon';

export { Simulator } from './simulator';
export type { SimulatorOptions } from './simulator';

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
