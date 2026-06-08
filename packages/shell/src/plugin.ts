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
 * Full implementation lands in L6.4.
 */

import type { Project } from '@monbolc/lowcode-designer';
import type { Workspace } from '@monbolc/lowcode-workspace';
import type { ICommandManager } from '@monbolc/lowcode-plugin-command';
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
  /** The active editing project. */
  project: Project;
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
