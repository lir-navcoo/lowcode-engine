/**
 * @monbolc/lowcode-editor-core — public types
 *
 * Editor public API: plugin context, editor composition root, and the
 * service-registration shapes that plugins use to wire themselves in.
 */

import type { Emitter } from '@monbolc/lowcode-utils';
import type { ICommandManager } from '@monbolc/lowcode-plugin-command';

import type { DIContainer, Factory } from './di';

/**
 * Alias for `Factory<T>` — used as the registration key in DI.
 * Exposed as a separate name so plugin authors can think of it as
 * "the key I registered this service under".
 */
export type ServiceFactory<T> = Factory<T>;

/** Lifecycle phases fired in order during Editor.init(). */
export type EditorPhase =
  | 'init'         // before plugins are registered
  | 'register'     // plugins are registering
  | 'ready'        // editor is fully booted
  | 'destroy';     // tearing down

export interface EditorEvents extends Record<string, unknown> {
  /** A lifecycle phase is about to enter. */
  phase: { name: EditorPhase };
  /** An error happened in a plugin. */
  error: { plugin: string; error: unknown };
  /** A plugin was registered. */
  pluginRegistered: { name: string };
}

/**
 * The public context object passed to each plugin's `init` callback.
 * Plugins call `ctx.something.register(...)` to wire themselves in.
 *
 * The full set of fields is filled out by the concrete `Editor` impl;
 * this interface is intentionally narrow to make plugin authoring
 * discoverable.
 */
export interface IPluginContext {
  /** Editor identifier (for diagnostics). */
  readonly editor: IEditor;
  /** Internationalization helper. */
  readonly i18n: I18n;
  /** DI container — used by plugins to register / consume services. */
  readonly di: DIContainer;
  /** Event bus. */
  readonly events: Emitter<EditorEvents>;
  /** Plugin registry. */
  readonly plugins: IPluginManager;
  /** Command manager. */
  readonly commands: ICommandManager;
}

export interface IEditor {
  /** Emitter for editor-wide events. */
  readonly events: Emitter<EditorEvents>;

  /** Boot the editor. Returns when all plugins' init() has resolved. */
  init(plugins?: IPlugin[]): Promise<void>;

  /** Tear down all plugins and release resources. */
  destroy(): Promise<void>;

  /** Whether init has finished successfully. */
  readonly ready: boolean;

  /** Get a service from the DI container. */
  get<T>(ctor: ServiceFactory<T>): Promise<T>;

  /** Try to get a service synchronously. Returns undefined if not yet registered. */
  peek<T>(ctor: ServiceFactory<T>): T | undefined;
}

export interface IPlugin {
  /** Unique plugin name (e.g. `"@monbolc/plugin-designer"`). */
  name: string;

  /**
   * Optional list of plugin names this one depends on.
   * The PluginManager will ensure they init first.
   */
  dependencies?: string[];

  /**
   * Initialize the plugin. Called once after all deps are ready.
   * `ctx` exposes the public API the plugin can use to register services.
   */
  init?(ctx: IPluginContext): void | Promise<void>;

  /**
   * Tear-down hook. Called in reverse init order.
   */
  destroy?(ctx: IPluginContext): void | Promise<void>;
}

export interface IPluginManager {
  /** Register a plugin. Validates name uniqueness. */
  register(plugin: IPlugin): void;

  /** Unregister a plugin by name. */
  unregister(name: string): boolean;

  /** True if a plugin with this name is registered. */
  has(name: string): boolean;

  /** Get the registered plugin, or undefined. */
  get(name: string): IPlugin | undefined;

  /** All registered plugins, sorted by dependency order. */
  list(): IPlugin[];
}

export interface I18nMessage {
  /** Default locale string. */
  default: string;
  /** Optional per-locale overrides. Locale code → string. */
  byLocale?: Record<string, string>;
}

export interface I18n {
  /** Register (or merge) a bag of messages. */
  register(messages: Record<string, I18nMessage | string>): void;

  /** Resolve a message id, optionally with the active locale. */
  t(id: string, locale?: string, fallback?: string): string;

  /** Set / change the active locale. Empty string = use `default`. */
  setLocale(locale: string): void;

  /** Currently active locale. */
  readonly locale: string;
}
