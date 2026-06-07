/**
 * @monbolc/lowcode-editor-core — Editor (composition root)
 *
 * The `Editor` class wires DI, i18n, the plugin manager, and the command
 * manager into a single object. Subclasses (e.g. a future
 * `BrowserEditor`) can override `init` to also mount UI.
 */

import { Emitter } from '@monbolc/lowcode-utils';
import { CommandManager } from '@monbolc/lowcode-plugin-command';

import { DIContainer } from './di';
import { I18nImpl } from './i18n';
import { PluginManager } from './plugin';

import type { Factory } from './di';
import type {
  EditorEvents,
  IEditor,
  IPlugin,
  IPluginContext,
  IPluginManager,
  I18n,
} from './types';

export interface EditorOptions {
  /** Locale to use by default (e.g. "en_US", "zh_CN"). Empty = `default`. */
  locale?: string;
  /** Pre-registered plugins. May be added later via `init` too. */
  plugins?: IPlugin[];
}

export class Editor implements IEditor {
  readonly events = new Emitter<EditorEvents>();
  readonly i18n: I18n = new I18nImpl();
  readonly di = new DIContainer();
  readonly plugins: IPluginManager;
  readonly commands = new CommandManager();
  readonly id: string;

  private _ready = false;
  private readonly initialPlugins: IPlugin[];

  constructor(options: EditorOptions = {}) {
    this.id = `editor_${Math.random().toString(36).slice(2, 10)}`;
    this.plugins = new PluginManager(this.events);
    this.initialPlugins = options.plugins ?? [];
    if (options.locale) this.i18n.setLocale(options.locale);
  }

  get ready(): boolean {
    return this._ready;
  }

  async init(extraPlugins: IPlugin[] = []): Promise<void> {
    if (this._ready) {
      throw new Error(`[Editor:${this.id}] init() called twice`);
    }
    this.events.emit('phase', { name: 'init' });

    for (const p of this.initialPlugins) this.plugins.register(p);
    for (const p of extraPlugins) this.plugins.register(p);
    this.events.emit('phase', { name: 'register' });

    const ctx: IPluginContext = {
      editor: this,
      i18n: this.i18n,
      di: this.di,
      events: this.events,
      plugins: this.plugins,
      commands: this.commands,
    };

    await (this.plugins as PluginManager).initAll(ctx);

    this._ready = true;
    this.events.emit('phase', { name: 'ready' });
  }

  async destroy(): Promise<void> {
    if (!this._ready) return;
    this.events.emit('phase', { name: 'destroy' });
    const ctx: IPluginContext = {
      editor: this,
      i18n: this.i18n,
      di: this.di,
      events: this.events,
      plugins: this.plugins,
      commands: this.commands,
    };
    await (this.plugins as PluginManager).destroyAll(ctx);
    this.di.clear();
    this.commands.clearHistory();
    this._ready = false;
  }

  async get<T>(ctor: Factory<T>): Promise<T> {
    return this.di.get(ctor);
  }

  peek<T>(ctor: Factory<T>): T | undefined {
    return this.di.peek(ctor);
  }
}
