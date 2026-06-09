/**
 * @monbolc/lowcode-plugin-setters — Public types (v2.3.0)
 *
 * Slim re-exports for shell / engine consumers that don't want to
 * pull in the full `registry.ts` module (which carries the private
 * `Map` and the descriptor helpers). Sapu stance: no proxy, no
 * facade — these are plain interfaces that match the real
 * registry's shape.
 */

import type { SetterComponent } from './registry';

/**
 * Read-only view of the setters registry. Exposed on
 * `ISapuEngine.setters` and `IPluginContext.setters`. Mutation
 * goes through `registerSetter()` from this package.
 *
 * Why this is an interface and not the raw Map: the L6 shell
 * wants a stable, named surface (so `engine.setters` typed
 * correctly without forcing plugin authors to know about the
 * internal Map). The implementation in `SapuEngine` is a
 * one-liner: `list: getRegisteredSetterNames`.
 */
export interface ISettersRegistry {
  /** Snapshot the registered setter names. Sorted alphabetically. */
  list(): string[];
}

/** Re-export so consumers can `import type { SetterComponent }` from here. */
export type { SetterComponent };
