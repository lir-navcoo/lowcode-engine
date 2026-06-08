/**
 * @monbolc/lowcode-shell — SapuEngine
 *
 * The host-facing facade. One engine per editing session. Owns:
 *   - a Project (L3)
 *   - an EngineEventBus (L6.2)
 *   - a ShellI18n (L6.5)
 *   - a plugin registry (slim — no mobx, no deprecation, no proxy)
 *
 * Sapu stance: no deprecation layer, no `engine.plugins.Foo` proxy
 * magic, no per-plugin scoped Skeleton/Event/Command. The plugin
 * author gets the same plain `IPluginContext` and the same
 * `SapuEngine` reference. Slim by design — ~85% smaller than ali's
 * `engine-core.ts` (which is 287 LoC and has its own
 * `pluginContextApiAssembler.assembleApis` reflection-style
 * indirection).
 *
 * The engine is React-free at the class level. L7's `init()` is
 * what mounts the React tree (Skeleton) into a container; this
 * class just owns the project + plugins.
 */

import { Project } from '@monbolc/lowcode-designer';
import type { Workspace } from '@monbolc/lowcode-workspace';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

import { EngineEventBus } from './events';
import type { IPlugin, IPluginContext } from './plugin';
import { ShellI18n } from './i18n';

export interface MountOptions {
  /** The root schema the editor will load. */
  schema: IPublicTypeRootSchema;
  /** Component registry passed to the simulator. */
  components: Record<string, unknown>;
  /** Optional L5 workspace — when provided, plugins can use the
   * multi-doc API instead of the single-project one. */
  workspace?: Workspace;
}

export interface ISapuEngine {
  readonly events: EngineEventBus;
  readonly i18n: ShellI18n;
  readonly plugins: ReadonlyArray<IPlugin>;
  getProject(): Project;
  mount(options: MountOptions): Project;
  destroy(): void;
  registerPlugin(plugin: IPlugin): void;
  unregisterPlugin(name: string): boolean;
  hasPlugin(name: string): boolean;
  t(key: string, vars?: Record<string, string | number>): string;
}

export class SapuEngine implements ISapuEngine {
  readonly events = new EngineEventBus();
  readonly i18n = new ShellI18n();

  private readonly _plugins = new Map<string, IPlugin>();
  private _project: Project | null = null;
  private _destroyed = false;

  get plugins(): ReadonlyArray<IPlugin> {
    return Array.from(this._plugins.values());
  }

  getProject(): Project {
    if (!this._project) {
      throw new Error(
        '[SapuEngine] getProject() called before mount(). ' +
          'Call engine.mount({schema, components}) first.',
      );
    }
    return this._project;
  }

  mount(options: MountOptions): Project {
    if (this._destroyed) {
      throw new Error('[SapuEngine] mount() called after destroy().');
    }
    if (this._project) {
      throw new Error('[SapuEngine] mount() called twice. Call destroy() first.');
    }
    this._project = new Project(options.schema);
    // Fire the ready event synchronously so listeners attached
    // before mount() can observe it (e.g. analytics, error reporters).
    this.events.emit('engineReady', {});
    return this._project;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    // Call destroy() on every registered plugin in reverse insertion
    // order. Errors are caught and surfaced as `pluginError` events
    // (so one bad plugin doesn't block the cleanup of the rest).
    const list = Array.from(this._plugins.values()).reverse();
    for (const plugin of list) {
      if (!plugin.destroy) continue;
      try {
        plugin.destroy();
      } catch (err) {
        this.events.emit('pluginError', { name: plugin.name, error: err });
      }
    }
    this._plugins.clear();
    this._project = null;
    this.events.emit('engineDestroyed', {});
  }

  registerPlugin(plugin: IPlugin): void {
    if (this._destroyed) {
      throw new Error('[SapuEngine] registerPlugin() called after destroy().');
    }
    if (this._plugins.has(plugin.name)) {
      throw new Error(
        `[SapuEngine] plugin "${plugin.name}" is already registered`,
      );
    }
    if (!/^[A-Za-z0-9_@./\-]+$/.test(plugin.name)) {
      throw new Error(
        `[SapuEngine] plugin name "${plugin.name}" contains invalid characters`,
      );
    }
    this._plugins.set(plugin.name, plugin);
    this.events.emit('pluginRegistered', { name: plugin.name });
    // Call init() synchronously. Sapu stance: no async, no topo sort
    // (ali had both; we drop both for slimness — the plugin author
    // is responsible for their own ordering via the `init()` body).
    // If init throws, we emit `pluginError` and UNREGISTER the
    // plugin so a subsequent registerPlugin(name) call can succeed.
    try {
      const ctx: IPluginContext = this._buildContext();
      plugin.init(ctx);
    } catch (err) {
      this._plugins.delete(plugin.name);
      this.events.emit('pluginError', { name: plugin.name, error: err });
    }
  }

  unregisterPlugin(name: string): boolean {
    const plugin = this._plugins.get(name);
    if (!plugin) return false;
    if (plugin.destroy) {
      try {
        plugin.destroy();
      } catch (err) {
        this.events.emit('pluginError', { name, error: err });
      }
    }
    this._plugins.delete(name);
    this.events.emit('pluginUnregistered', { name });
    return true;
  }

  hasPlugin(name: string): boolean {
    return this._plugins.has(name);
  }

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.t(key, vars);
  }

  /**
   * Build the per-plugin context. Currently all plugins share the
   * same context (no `eventPrefix`/`commandScope` like ali had).
   * `registerPlugin` / `unregisterPlugin` are bound to this engine
   * so a plugin author can chain `ctx.registerPlugin(otherPlugin)`
   * from inside their own init().
   */
  private _buildContext(): IPluginContext {
    return {
      project: this.getProject(),
      events: this.events,
      i18n: this.i18n,
      registerPlugin: (p) => this.registerPlugin(p),
      unregisterPlugin: (name) => { this.unregisterPlugin(name); },
      t: (key, vars) => this.i18n.t(key, vars),
    };
  }
}
