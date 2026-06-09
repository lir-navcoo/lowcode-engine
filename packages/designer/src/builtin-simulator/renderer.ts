/**
 * @monbolc/lowcode-designer — builtin-simulator/renderer
 * Ali-mirror Phase D.I2: the `BuiltinSimulatorRenderer` type + the
 * `isSimulatorRenderer` type guard.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/renderer.ts`.
 * Ali's 8-LoC file:
 *   - imports `Component` from `../simulator` (sapu's slim `Simulator`
 *     is a separate concern that doesn't expose `Component` directly)
 *   - aliases `BuiltinSimulatorRenderer = IPublicTypeSimulatorRenderer<Component, IPublicTypeComponentInstance>`
 *   - exports `isSimulatorRenderer(obj)` (1-line duck check)
 *
 * Slim port: the `Component` and `IPublicTypeComponentInstance` types
 * are passed as `unknown` defaults (the slim port defers their concrete
 * shapes to a later commit). The type guard is ali-faithful.
 */
import type { IPublicTypeSimulatorRenderer } from '@monbolc/lowcode-types';

export type BuiltinSimulatorRenderer = IPublicTypeSimulatorRenderer<unknown, unknown>;

/**
 * Slim 1-line type guard. Ali-faithful: `obj && obj.isSimulatorRenderer`
 * (the discriminator flag).
 */
export function isSimulatorRenderer(obj: unknown): obj is BuiltinSimulatorRenderer {
  return !!obj && typeof obj === 'object' && (obj as { isSimulatorRenderer?: boolean }).isSimulatorRenderer === true;
}
