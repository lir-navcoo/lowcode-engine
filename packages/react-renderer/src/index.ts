/**
 * @monbolc/lowcode-react-renderer — barrel export
 *
 * SapuLowcodeEngine L3 — first package that actually imports React.
 * Consumers must call `setupReactRenderer()` once at boot, after which
 * `adapter.getRenderers()` and `adapter.getRuntime()` will return
 * React-backed implementations.
 */

export { installReactRuntime, isReactRuntimeInstalled, uninstallReactRuntime, createReactRoot } from './inject';

export { setupReactRenderer, ReactRenderer } from './render';
export type { IRenderComponent, IRendererProps } from '@monbolc/lowcode-renderer-core';
