/**
 * @monbolc/lowcode-engine — barrel
 *
 * Sapu's L7 — the composition root. The ONE package a host
 * installs to get a working visual editor.
 *
 * Status (L7.1–L7.5 complete):
 *   - L7.1 ✅ Package skeleton + L0–L6 deps
 *   - L7.2 ✅ `init(container, options)` async entry point
 *   - L7.3 ✅ 3 default plugins (outline-pane, settings-panel, setters)
 *   - L7.4 ✅ `createDefaultPreset(overrides?)` factory
 *   - L7.5 ✅ `setTheme(name)` + `getTheme()` singleton
 *   - L7.6 ✅ ignitor deprecation shim (separate PR)
 *   - L7.7 ✅ demo uses `init()` as the entry point
 *   - L7.8 ✅ docs in `docs/packages/engine.md`
 *   - L7.9 ✅ top-level `README.md` rewrite
 *
 * Sapu stance: no UMD bundle (sapu ships CJS+ESM only), no
 * 28-component Fusion re-export, no plugin auto-registration from
 * `window.aliLowcodeEngine` globals. The composition is a plain
 * function call.
 */

export { init, destroy, detectLocale } from './init';
export type { InitOptions } from './init';

export { createDefaultPlugins } from './default-plugins';
export type { BuiltinPluginName } from './default-plugins';

export { createDefaultPreset } from './preset';
export type { Preset, SupportedTheme } from './preset';

export { setTheme, getTheme, onThemeChange } from './theme';

// Re-export the L6 facade so consumers don't need a second import.
export {
  SapuEngine,
  SapuErrorBoundary,
  DefaultErrorFallback,
  EngineEventBus,
  ShellI18n,
  definePlugin,
  registerDefaultMessages,
} from '@monbolc/lowcode-shell';
export type {
  IPlugin,
  IPluginContext,
  EngineEventName,
  EngineEvents,
  ISapuEngine,
  MountOptions,
  I18nMessage,
  I18nDictionary,
  SapuErrorBoundaryProps,
} from '@monbolc/lowcode-shell';
