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
import {
  Project,
  DocumentModel,
  InsertCommand,
  RemoveCommand,
  MoveCommand,
  SetPropCommand,
  RenameCommand,
} from '@monbolc/lowcode-designer';

export type BuiltinPluginName =
  | '@sapu/builtin-outline-pane'
  | '@sapu/builtin-settings-panel'
  | '@sapu/builtin-setters'
  | '@sapu/builtin-document-commands';

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

// (no top-level debug log)
/**
 * The document-commands plugin (P12.1). Registers the five
 * core document mutations on the engine's CommandManager so
 * any host that uses the default plugin set gets undo/redo
 * for free. Hosts call:
 *   await engine.commands.execute('document.remove', { nodeId });
 *   engine.commands.undo();  // re-inserts the node
 *   engine.commands.redo();  // removes it again
 *
 * Project is resolved LAZILY at command-execute time, not at
 * plugin-init time. Reason: the shell mounts the Project
 * AFTER registering the default plugins (so the host can
 * re-init / re-mount without unregistering), and `ctx.project`
 * is null at init. The command closures capture a getter
 * that resolves to the current project on every execute.
 *
 * The inner command is constructed on first execute and
 * reused for the matching undo (so `RemoveCommand`'s
 * `snapshot` field survives the round-trip).
 */
const documentCommandsPlugin: IPlugin = {
  name: '@sapu/builtin-document-commands',
  init(ctx: IPluginContext): void {
    // Register a thin proxy Command for each document mutation.
    // The proxy holds a reference to the live `ctx` and resolves
    // the project's document on every call. This survives
    // re-mounts AND keeps the inner command's instance state
    // (e.g. RemoveCommand's `snapshot` for undo) alive across
    // the execute/undo pair.
    type AnyCmd = {
      name: string;
      readonly mergeable?: boolean;
      execute(args: unknown): unknown;
      undo(args: unknown, ret: unknown): void;
    };
    const wrap = (Ctor: new (doc: DocumentModel) => AnyCmd, name: string, mergeable = false): AnyCmd => {
      // The inner command lives across execute + undo (so its
      // instance state — like RemoveCommand's `snapshot` — is
      // preserved). We rebuild it only when the project swaps
      // (rare: only on engine.reinit).
      let inner: AnyCmd | null = null;
      const ensureInner = (): AnyCmd => {
        const doc = ctx.project?.document;
        if (!doc) throw new Error(`[sapu] no project mounted for ${name}`);
        if (!inner) inner = new Ctor(doc);
        return inner;
      };
      const proxy: AnyCmd = {
        name,
        mergeable,
        execute(args: unknown): unknown {
          return ensureInner().execute(args);
        },
        undo(args: unknown, ret: unknown): void {
          // Don't recreate the inner command on undo — that
          // would wipe the snapshot RemoveCommand needs.
          if (!inner) return;
          inner.undo(args, ret);
        },
      };
      return proxy;
    };
    ctx.commands.register(wrap(InsertCommand, 'document.insert'));
    ctx.commands.register(wrap(RemoveCommand, 'document.remove'));
    ctx.commands.register(wrap(MoveCommand, 'document.move'));
    ctx.commands.register(wrap(SetPropCommand, 'document.setProp', true));
    ctx.commands.register(wrap(RenameCommand, 'document.rename'));
  },
};

/**
 * The full default-plugin set. Order matters only for the
 * `destroy()` reverse-iteration: Setters register first so it
 * destroys last.
 */
export function createDefaultPlugins(): IPlugin[] {
  return [outlinePanePlugin, settingsPanelPlugin, settersPlugin, documentCommandsPlugin];
}
