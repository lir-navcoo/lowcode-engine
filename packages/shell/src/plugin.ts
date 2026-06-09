/**
 * @monbolc/lowcode-shell — Plugin contract
 *
 * Sapu's stance: plugins get a plain `IPluginContext` (no proxy
 * layer, no deprecation wrappers). Plugins call into the real
 * classes via the references the context exposes. The
 * `definePlugin` helper is a pure identity function — it exists
 * for DX (lets plugin authors write `definePlugin({ ... })` to
 * make their intent explicit) but does no runtime magic.
 *
 * v2.3.0 (2026-06-09): the 8 experimental v2.3 facade slots
 * (skeleton / material / project / hotkey / setters / plugins /
 * logger / config) are removed. The context now exposes plain
 * references to the underlying L3 / L2.5 / utils classes:
 *   - `project` → L3 `Project` class
 *   - `material` → L3 `ComponentMetaRegistry` (alias of project.componentMetas)
 *   - `setters` → L2.5 `ISettersRegistry`
 *   - `plugins` → ReadonlyArray<IPlugin>
 *   - `logger`  → utils `Logger`
 * Slots that don't have a real class yet (skeleton / hotkey / config)
 * are deferred — they will land in the v2.4 host-only facade plan
 * (see ROADMAP P2.7 follow-up). The `workspace` slot is unchanged.
 *
 * Full implementation lands in L6.4.
 */

import type { Project, ComponentMetaRegistry } from '@monbolc/lowcode-designer';
import type { Workspace } from '@monbolc/lowcode-workspace';
import type { ICommandManager } from '@monbolc/lowcode-plugin-command';
import type { ISettersRegistry } from '@monbolc/lowcode-plugin-setters';
import type { Logger } from '@monbolc/lowcode-utils';
import type { IPublicModelDragon, IPublicTypeNodeLike } from '@monbolc/lowcode-types';

import type { EngineEventBus } from './events';
import type { ShellI18n } from './i18n';
import type { PublicDragon } from './dragon';

/**
 * The surface a plugin is handed at registration time. Sapu's
 * stance: the context IS the engine surface — plugins call real
 * classes (no proxy). The shell is a thin layer that just bundles
 * references; the heavy lifting lives in the packages the
 * references come from.
 *
 * Note: this is a TYPED PREVIEW. The actual context will be
 * constructed in L6.3 (`SapuEngine.registerPlugin`). For now, the
 * interface declares the contract so downstream code can be
 * authored against the right shape.
 */
export interface IPluginContext {
  /** The L5 workspace (may be undefined for single-doc hosts). */
  workspace?: Workspace;
  /** The engine event bus — typed payloads per `EngineEvents`. */
  events: EngineEventBus;
  /** The engine's i18n instance (the same `engine.i18n` reference). */
  i18n: ShellI18n;
  /** The L2 command manager — same reference as `engine.commands`. */
  commands: ICommandManager;
  /**
   * The v2.3 public Dragon facade — same reference as
   * `engine.dragon`. Plugins use it to register drop-target
   * sensors, subscribe to `dragstart` / `drag` / `dragend`,
   * or wire DOM elements as drag sources via `dragon.from`.
   */
  dragon: PublicDragon | IPublicModelDragon<IPublicTypeNodeLike>;
  /**
   * The active editing project (same reference as `engine.project`).
   * Throws if accessed before `mount()`.
   */
  project: Project;
  /**
   * The component-metadata registry (same reference as
   * `engine.material` and `project.componentMetas`).
   */
  material: ComponentMetaRegistry;
  /** The setters registry (same reference as `engine.setters`). */
  setters: ISettersRegistry;
  /** Snapshot of registered plugins, in insertion order. */
  plugins: ReadonlyArray<IPlugin>;
  /** The shared logger (same reference as `engine.logger`). */
  logger: Logger;
  /** Register another plugin from inside this one. */
  registerPlugin(plugin: IPlugin): void;
  /** Unregister a previously-registered plugin by name. */
  unregisterPlugin(name: string): void;
  /**
   * Localized message accessor. Falls back to en-US for missing
   * keys. Full implementation lands in L6.5.
   */
  t(key: string, vars?: Record<string, string | number>): string;
}

export interface IPlugin {
  /** Unique plugin name. The shell enforces uniqueness. */
  name: string;
  /**
   * Called synchronously when `registerPlugin` runs. The plugin
   * may attach event listeners, register custom setters, etc.
   * Throwing here is caught by the shell's ErrorBoundary and
   * surfaced as a `pluginError` event.
   */
  init(context: IPluginContext): void;
  /**
   * Optional teardown. Called on `unregisterPlugin` and on
   * `engine.destroy`. Idempotent.
   */
  destroy?(): void;
}

/**
 * Identity helper. Authoring a plugin as
 *   export default definePlugin({ name: 'foo', init: (ctx) => ... })
 * makes the intent explicit and gives the type checker a chance
 * to flag malformed plugin shapes. Runtime: no-op.
 */
export function definePlugin<P extends IPlugin>(plugin: P): P {
  return plugin;
}
