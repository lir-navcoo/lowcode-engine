/**
 * @monbolc/lowcode-renderer-core — barrel export
 *
 * SapuLowcodeEngine renderer abstractions (L2). Framework-agnostic — the
 * concrete React implementation is in @monbolc/lowcode-react-renderer.
 */

export { adapter } from './adapter';
export { BaseRenderer, ensureRuntimeLoaded } from './base';
export {
  PageRenderer,
  ComponentRenderer,
  BlockRenderer,
  AddonRenderer,
  TempRenderer,
  DivRenderer,
  pageRendererFactory,
  componentRendererFactory,
  blockRendererFactory,
  addonRendererFactory,
  tempRendererFactory,
  divRendererFactory,
} from './renderer';

export type {
  IConfigProvider,
  IRenderComponent,
  IRendererModules,
  IRendererProps,
  IRendererState,
  IRuntime,
} from './types';
