/**
 * @monbolc/lowcode-engine — default plugins
 *
 * The three plugins a host gets "for free" when calling
 * `createDefaultPreset()`. Each plugin's `init()` is a single,
 * idempotent side-effect that wires a feature into the engine.
 *
 * Sapu stance: no plugin pre-registration via `window.ali*`
 * globals, no global "plugin-setters auto-registers on import"
 * side effects. Each plugin is a plain object; the host sees the
 * names and can `unregisterPlugin('setters')` to disable a
 * feature.
 *
 * Plugin name conventions:
 *   - `'@sapu/builtin-outline-pane'`
 *   - `'@sapu/builtin-settings-panel'`
 *   - `'@sapu/builtin-setters'`
 *
 * The `@sapu/` prefix keeps them clearly distinguished from
 * host plugins (which usually use the host's npm scope).
 */

import type { IPlugin, IPluginContext } from '@monbolc/lowcode-shell';
import { registerBuiltInSetters } from '@monbolc/lowcode-plugin-setters';

export type BuiltinPluginName =
  | '@sapu/builtin-outline-pane'
  | '@sapu/builtin-settings-panel'
  | '@sapu/builtin-setters';

/**
 * The outline-pane plugin. The L4 Skeleton already mounts the
 * pane in the left area; this plugin's job is to call any
 * post-mount wiring (none today, but the plugin exists for
 * symmetry and so hosts can `unregisterPlugin` to disable it).
 */
const outlinePanePlugin: IPlugin = {
  name: '@sapu/builtin-outline-pane',
  init(_ctx: IPluginContext): void {
    // The L4 Skeleton renders the OutlineView in the left pane
    // unconditionally. Future: register custom OutlineView
    // wrappers, default-expansion rules, etc.
  },
};

/**
 * The settings-panel plugin. Same pattern as outline-pane —
 * the Skeleton renders the SettingsPanel in the right pane;
 * this plugin is a hook for future post-mount wiring.
 */
const settingsPanelPlugin: IPlugin = {
  name: '@sapu/builtin-settings-panel',
  init(_ctx: IPluginContext): void {
    // The L4 Skeleton renders the SettingsPanel in the right pane
    // unconditionally. Future: register custom prop normalizers,
    // default-collapse rules, etc.
  },
};

/**
 * The setters plugin. Calls `registerBuiltInSetters()` once, which
 * registers Input / TextArea / Number / Switch / Select /
 * ColorPicker / Slider into the global setter registry used by
 * the L4 SettingsPanel.
 */
const settersPlugin: IPlugin = {
  name: '@sapu/builtin-setters',
  init(_ctx: IPluginContext): void {
    registerBuiltInSetters();
  },
};

/**
 * The full default-plugin set. Order matters only for the
 * `destroy()` reverse-iteration: Setters register first so it
 * destroys last.
 */
export function createDefaultPlugins(): IPlugin[] {
  return [outlinePanePlugin, settingsPanelPlugin, settersPlugin];
}
