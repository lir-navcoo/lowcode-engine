/**
 * @monbolc/lowcode-shell — Engine event types
 *
 * Typed event names + payload interfaces for the host-facing
 * `SapuEngine` event bus. Sapu uses the L1 `Emitter<EventMap>` for
 * transport, and the `EventMap` shape is constrained to satisfy its
 * `Record<string, unknown>` requirement — so we use a type alias,
 * not an interface (interfaces don't satisfy `Record<string, ...>`).
 *
 * Event names follow the camelCase convention used elsewhere in the
 * engine (e.g. `selectionChanged`, `nodePropsChanged`). Future
 * plugin authors will subscribe via:
 *
 *   engine.events.on('schemaChanged', ({ root }) => { ... });
 */

import { Emitter } from '@monbolc/lowcode-utils';

export type EngineEventName =
  | 'engineReady'
  | 'engineDestroyed'
  | 'pluginRegistered'
  | 'pluginUnregistered'
  | 'pluginError'
  | 'themeChanged'
  | 'workspaceChanged';

export type EngineEvents = {
  /** Fired once `engine.mount()` finishes wiring the Skeleton. */
  engineReady: Record<string, never>;
  /** Fired when `engine.destroy()` is called. */
  engineDestroyed: Record<string, never>;
  /** Fired after `registerPlugin` adds a new plugin. */
  pluginRegistered: { name: string };
  /** Fired after `unregisterPlugin` removes one. */
  pluginUnregistered: { name: string };
  /** Fired when a plugin's `init` or a plugin-supplied callback throws. */
  pluginError: { name: string; error: unknown };
  /** Fired when `setTheme` flips the active theme. */
  themeChanged: { from: string; to: string };
  /** Fired when the L5 Workspace's active resource changes. */
  workspaceChanged: { id: string | null };
};

/**
 * Typed event bus for the host-facing `SapuEngine`.
 *
 * Sapu stance: this is a thin proxy over the L1 `Emitter<EventMap>`,
 * NOT a hand-rolled event system. The `EngineEvents` type alias
 * gives compile-time payload checks; runtime is the same shared
 * emitter every other layer uses. One bus per `SapuEngine` instance
 * — there is no per-plugin scoped bus, no `eventPrefix` (ali had
 * it; we dropped it for slimness). If a plugin needs namespacing,
 * the plugin author can wrap their own.
 */
export class EngineEventBus {
  private readonly _emitter = new Emitter<EngineEvents>();

  on<K extends keyof EngineEvents>(
    event: K,
    handler: (payload: EngineEvents[K]) => void,
  ): () => void {
    return this._emitter.on(event, handler as (p: EngineEvents[K]) => void);
  }

  once<K extends keyof EngineEvents>(
    event: K,
    handler: (payload: EngineEvents[K]) => void,
  ): () => void {
    return this._emitter.once(event, handler as (p: EngineEvents[K]) => void);
  }

  off<K extends keyof EngineEvents>(
    event: K,
    handler?: (payload: EngineEvents[K]) => void,
  ): void {
    this._emitter.off(event, handler as ((p: EngineEvents[K]) => void) | undefined);
  }

  emit<K extends keyof EngineEvents>(event: K, payload: EngineEvents[K]): void {
    this._emitter.emit(event, payload);
  }

  removeAllListeners(event?: keyof EngineEvents): void {
    this._emitter.removeAllListeners(event);
  }

  listenerCount<K extends keyof EngineEvents>(event: K): number {
    return this._emitter.listenerCount(event);
  }
}
