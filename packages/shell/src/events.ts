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
