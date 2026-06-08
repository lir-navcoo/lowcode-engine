/**
 * @monbolc/lowcode-react-renderer — barrel export
 *
 * SapuLowcodeEngine L3 — first package that actually imports React.
 *
 * Public surface for hosts (called via the L7 `init()` composition
 * root, but importable directly if you want a Skeleton-less setup):
 *   - `installReactRuntime` / `uninstallReactRuntime` — runtime
 *     lifecycle (used internally by L7 init + tests)
 *   - `isReactRuntimeInstalled` — runtime presence check
 *   - `createReactRoot` — wrapper around `react-dom/client.createRoot`
 *     that goes through the adapter (so the test runtime can shim it)
 *   - `ReactRenderer` — concrete renderer class
 *
 * `@internal` (deprecated in 2.2.0, will be removed in 3.0.0):
 *   - `setupReactRenderer` — convenience wrapper that calls
 *     `installReactRuntime` + `adapter.setRenderers(createReactRenderers())`.
 *     L7 `init()` does this for you; direct callers should prefer
 *     `installReactRuntime` + `setRenderers` separately so each step
 *     is visible in the call site.
 *
 * `createReactRenderers` is NOT exported: it's a private factory
 * held inside `./renderers`. Hosts don't need to call it.
 */

export { installReactRuntime, isReactRuntimeInstalled, uninstallReactRuntime, createReactRoot } from './inject';

export { ReactRenderer } from './render';
/** @internal Deprecated in 2.2.0; will be removed in 3.0.0. L7 `init()` calls it for you. */
export { setupReactRenderer } from './render';
export type { IRenderComponent, IRendererProps } from '@monbolc/lowcode-renderer-core';
