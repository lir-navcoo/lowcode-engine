/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/manager
 * Ali-mirror Phase D.I2: the `BemToolsManager` extension registry.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/bem-tools/manager.ts`
 * (36 LoC plain JS / TS — no mobx, no React). The class holds an
 * array of `{ name, item }` entries registered by plugins; the
 * `<BemTools>` root component (Phase D.I6) reads via `getAllBemTools()`.
 *
 * Slim deltas:
 *   - `Designer` import (ali uses ali's `IDesigner` for ownership) →
 *     the slim `BemToolsManager` does NOT store a `designer` field; the
 *     host wires the manager into `host.designer.bemToolsManager` in
 *     Phase D.I6. The slim class is decoupled.
 *   - `invariant` from `@alilc/lowcode-utils` → re-implemented as a
 *     5-LoC local helper (no third-party import).
 */
import { invariant } from '../../utils/invariant';

/** Ali-faithful: a single bem-tool extension entry. */
export type BemToolsData = {
  name: string;
  item: React.ComponentType<{ host: BuiltinSimulatorHost }>;
};

import type { BuiltinSimulatorHost } from '../../simulator-host';
import type * as React from 'react';

/**
 * Ali-faithful `BemToolsManager` (36-LoC ali). Plain JS / TS class —
 * no mobx, no React, just a `BemToolsData[]` array with a dedup guard.
 * Plugins call `addBemTools({ name, item })` to register a custom
 * bem-tool overlay; `<BemTools>` reads via `getAllBemTools()` to render
 * them in registration order.
 */
export class BemToolsManager {
  private _items: BemToolsData[] = [];

  /**
   * Register a bem-tool. Duplicate names throw via `invariant`
   * (ali-faithful — `bem tools with name "${name}" already exists`).
   */
  addBemTools(data: BemToolsData): void {
    invariant(
      this._items.findIndex((d) => d.name === data.name) === -1,
      `bem tools with name "${data.name}" already exists`,
      data.name,
    );
    this._items.push(data);
  }

  /**
   * Unregister a bem-tool by name. No-op if the name is not registered
   * (ali-faithful).
   */
  removeBemTools(name: string): void {
    this._items = this._items.filter((d) => d.name !== name);
  }

  /**
   * Read all registered bem-tools, in registration order. The return
   * value is the live array — consumers should not mutate it.
   */
  getAllBemTools(): BemToolsData[] {
    return this._items;
  }
}
