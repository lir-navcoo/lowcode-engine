/**
 * @monbolc/lowcode-designer — barrel export
 *
 * SapuLowcodeEngine L3 designer. Provides:
 *   - DocumentModel: schema tree with mutation API
 *   - Node: ergonomic wrapper around a single schema node
 *   - Project: top-level container (document + selection + dragon)
 *   - Dragon: drag state machine
 *   - DOM utilities: rect math, id tagging, hit testing
 */

export { DocumentModel } from './document';
export type { DocumentEvents, IDocumentModel } from './document';

export { Node } from './node';

export { Project } from './project';
export type { ProjectEvents } from './project';

export { Dragon } from './dragon';
export type { DragonEvents, DragonState } from './dragon';

export {
  getRect,
  rectsOverlap,
  rectContains,
  rectMidpoint,
  findNodeIdFromElement,
  tagElementWithNodeId,
} from './dom';
export type { Rect } from './dom';
