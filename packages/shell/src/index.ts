/**
 * @monbolc/lowcode-shell — barrel
 *
 * Sapu's L6 — the host-facing facade. Plugins and host apps talk to
 * a single `SapuEngine` object and get typed access to the document,
 * simulator, project, events, i18n, ErrorBoundary, and a
 * `registerPlugin` slot.
 *
 * Status (L6.2-L6.6 complete):
 *   - L6.1 ✅ Package skeleton + IPlugin/IPluginContext types
 *   - L6.2 ✅ EngineEventBus (typed wrapper over L1 Emitter)
 *   - L6.3 ✅ SapuEngine class
 *   - L6.4 ✅ definePlugin helper + plugin tests
 *   - L6.5 ✅ ShellI18n with {var} substitution
 *   - L6.6 ✅ SapuErrorBoundary (React 19 class)
 *
 * L7 (in `@monbolc/lowcode-engine`) composes this with a default
 * preset and `init(container, options)`.
 */

export type { IPlugin, IPluginContext } from './plugin';
export { definePlugin } from './plugin';

export type { EngineEventName, EngineEvents } from './events';
export { EngineEventBus } from './events';

export { SapuEngine } from './sapu-engine';
export type { ISapuEngine, MountOptions } from './sapu-engine';

export { ShellI18n } from './i18n';
export type { I18nMessage, I18nDictionary, SupportedLocale } from './i18n';
export { defaultMessages, defaultLocale, registerDefaultMessages } from './locale';

export { SapuErrorBoundary, DefaultErrorFallback } from './error-boundary';
export type { SapuErrorBoundaryProps, SapuErrorBoundaryState } from './error-boundary';
