/**
 * @monbolc/lowcode-designer — builtin-simulator/host
 * Ali-mirror Phase D.I6 shim: the slim `host.ts` re-export.
 *
 * Ali's `host.ts` is 1615 LoC of the simulator host's full surface
 * (the most complex single file in the ali codebase). The slim port
 * does NOT port the 1615 LoC; the slim `BuiltinSimulatorHost` lives
 * at `../simulator-host` and was shipped in v2.2 with the Phase C
 * extensions (P1–P5).
 *
 * This file is a thin re-export so the bem-tool files can do
 * `import { BuiltinSimulatorHost } from '../host'` (matching ali's
 * import paths) without changing the slim module layout.
 */
export { BuiltinSimulatorHost } from '../simulator-host';
export type { SimulatorHostOptions, IPublicTypeComponentInstance, IPublicTypeRect, ComponentMoveHooks } from '../simulator-host';
