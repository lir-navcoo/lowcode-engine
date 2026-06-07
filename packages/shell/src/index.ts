/**
 * @monbolc/lowcode-shell — barrel
 *
 * Sapu's L6 — the host-facing facade. Plugins and host apps talk to
 * a single `SapuEngine` object and get typed access to the document,
 * simulator, project, events, and a `registerPlugin` slot.
 *
 * This package is currently the L6.1 SKELETON. Subsequent P-tasks
 * (see docs/ROADMAP.md P3 → L6) will add:
 *   - L6.2: EngineEventName + typed payload interfaces
 *   - L6.3: SapuEngine class + registerPlugin
 *   - L6.4: IPlugin / IPluginContext types + definePlugin helper
 *   - L6.5: i18n dictionary + t(key, vars?)
 *   - L6.6: ErrorBoundary component (React 19)
 *   - L6.7: demo wiring
 *   - L6.8: docs
 *
 * For now, the barrel re-exports the planned public surface so
 * downstream code can import it as a single symbol.
 */

export type { IPlugin, IPluginContext } from './plugin';
export { definePlugin } from './plugin';
export type { EngineEventName, EngineEvents } from './events';
