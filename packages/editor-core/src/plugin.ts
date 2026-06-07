/**
 * @monbolc/lowcode-editor-core — PluginManager
 *
 * Validates plugin names, topologically sorts by `dependencies`,
 * and exposes registration APIs.
 */

import { Emitter } from '@monbolc/lowcode-utils';

import type {
  EditorEvents,
  IPlugin,
  IPluginContext,
  IPluginManager,
} from './types';

export class PluginManager implements IPluginManager {
  private readonly plugins = new Map<string, IPlugin>();
  private sortedCache: IPlugin[] | null = null;
  private readonly eventBus: Emitter<EditorEvents>;

  constructor(eventBus: Emitter<EditorEvents>) {
    this.eventBus = eventBus;
  }

  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`[PluginManager] plugin "${plugin.name}" is already registered`);
    }
    if (!/^[A-Za-z0-9_@./\-]+$/.test(plugin.name)) {
      throw new Error(
        `[PluginManager] plugin name "${plugin.name}" contains invalid characters`,
      );
    }
    this.plugins.set(plugin.name, plugin);
    this.sortedCache = null; // invalidate sort cache
    this.eventBus.emit('pluginRegistered', { name: plugin.name });
  }

  unregister(name: string): boolean {
    const existed = this.plugins.delete(name);
    if (existed) this.sortedCache = null;
    return existed;
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  get(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  list(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Return plugins in dependency order: deps first, then dependents.
   * Throws on circular or missing deps.
   */
  sortedByDeps(): IPlugin[] {
    if (this.sortedCache) return this.sortedCache;
    const result: IPlugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (plugin: IPlugin) => {
      if (visited.has(plugin.name)) return;
      if (visiting.has(plugin.name)) {
        throw new Error(`[PluginManager] circular dependency at "${plugin.name}"`);
      }
      visiting.add(plugin.name);
      for (const dep of plugin.dependencies ?? []) {
        const sub = this.plugins.get(dep);
        if (!sub) {
          throw new Error(
            `[PluginManager] plugin "${plugin.name}" depends on missing plugin "${dep}"`,
          );
        }
        visit(sub);
      }
      visiting.delete(plugin.name);
      visited.add(plugin.name);
      result.push(plugin);
    };

    for (const plugin of this.plugins.values()) visit(plugin);
    this.sortedCache = result;
    return result;
  }

  /**
   * Run init() for each plugin in dep order. If any throws, the error
   * is rethrown but earlier plugins remain initialized.
   */
  async initAll(ctx: IPluginContext): Promise<void> {
    for (const plugin of this.sortedByDeps()) {
      if (!plugin.init) continue;
      try {
        await plugin.init(ctx);
      } catch (err) {
        this.eventBus.emit('error', { plugin: plugin.name, error: err });
        throw err;
      }
    }
  }

  /**
   * Run destroy() in reverse init order. Errors are swallowed and emitted
   * so one bad plugin doesn't prevent others from cleaning up.
   */
  async destroyAll(ctx: IPluginContext): Promise<void> {
    const plugins = [...this.sortedByDeps()].reverse();
    for (const plugin of plugins) {
      if (!plugin.destroy) continue;
      try {
        await plugin.destroy(ctx);
      } catch (err) {
        this.eventBus.emit('error', { plugin: plugin.name, error: err });
      }
    }
  }
}
