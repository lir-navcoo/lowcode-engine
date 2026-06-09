/**
 * @monbolc/lowcode-designer — builtin-simulator/context
 * Ali-mirror Phase D.I2: the React `SimulatorContext` for the
 * BuiltinSimulatorHost.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/context.ts`.
 * Ali's 4-LoC file: `createContext<BuiltinSimulatorHost>({} as any)`.
 * Sapu's slim port keeps the same shape — the bem-tool `BoxResizing`
 * (Phase D.I7) reads `this.context` as a fallback for `this.props.host`.
 *
 * Default value: `{} as BuiltinSimulatorHost`. Slim's `BuiltinSimulatorHost`
 * is the runtime class; if a consumer mounts a `<SimulatorContext.Provider>`
 * with a real host, all consumers reading the context get the real host.
 * Otherwise (no Provider) the default `{}` is used and consumers
 * gracefully fall through to `props.host` checks.
 */
import { createContext } from 'react';
import type { BuiltinSimulatorHost } from '../simulator-host';

/**
 * Slim port of ali's `SimulatorContext`. The default `{}` lets consumers
 * (bem-tool class components) read the context without throwing when no
 * Provider is mounted — they should always pass `host` via props, but
 * the context is an escape hatch for nested cases.
 */
export const SimulatorContext = createContext<BuiltinSimulatorHost>({} as BuiltinSimulatorHost);
