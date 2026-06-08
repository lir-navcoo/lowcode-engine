# Authoring SapuLowcodeEngine plugins

> A focused, code-first guide for plugin authors. Sapu's plugin
> API is intentionally small (`IPlugin` + `IPluginContext`); this
> doc covers everything you can do with it.

## The plugin contract

A plugin is a plain object with a unique `name` and an `init(ctx)`
method. The engine calls `init` synchronously during
`registerPlugin` (or during `init()` for plugins in the default
preset). Throwing inside `init` is caught by the shell's
`ErrorBoundary` and surfaced as a `pluginError` event — so a
broken plugin doesn't break the rest of the editor.

```ts
import { definePlugin, type IPluginContext } from '@monbolc/lowcode-shell';

export default definePlugin({
  name: '@acme/sapu-save-indicator',
  init(ctx: IPluginContext): void {
    // 1. read project / commands / events / i18n off the ctx
    // 2. register listeners, custom setters, commands
    // 3. return synchronously (no Promises, no async work)
  },
  destroy?(): void {
    // Optional: tear down listeners when the engine is destroyed
    // or the plugin is unregistered. Idempotent.
  },
});
```

`definePlugin` is a pure identity helper — it makes the
authoring intent explicit and gives the type checker a chance
to flag malformed plugin shapes at build time. Runtime: no-op.

## Registering a plugin

```ts
import { init } from '@monbolc/lowcode-engine';
import myPlugin from '@acme/sapu-save-indicator';

const engine = await init('#editor', {
  schema,
  components: {},
});

// Add to the default preset (3 built-in + your plugin).
engine.registerPlugin(myPlugin);

// Or override the entire preset (3 built-ins go away —
// you're responsible for re-adding anything you still need).
engine.registerPlugin(myPlugin);
engine.registerPlugin(outlinePanePlugin);
engine.registerPlugin(settingsPanelPlugin);
engine.registerPlugin(settersPlugin);
```

The engine fires `pluginRegistered` and `pluginError` events
that you can listen to from outside the engine.

## What's on the context

`IPluginContext` exposes the live engine — every reference
on it is the same instance the host sees through the engine
handle. Mutating state through the context is identical to
mutating it through `engine.<thing>`.

| Field | Use it for |
|---|---|
| `project` | Read/write the document, fire `nodeAdded` / `nodeRemoved` events, register custom node sensors |
| `workspace?` | (optional) Resource lifecycle — single-doc hosts may not have one |
| `events` | Subscribe to `engineReady`, `engineDestroyed`, `pluginRegistered`, `pluginError`, theme changes, `beforeInit` |
| `i18n` | Register dictionaries, change locale, translate strings |
| `commands` | Register / execute / undo / redo commands |
| `dragon` | Register drop-target sensors, listen to `dragstart` / `drag` / `dragend`, bind a DOM element as a drag source via `dragon.from` |
| `registerPlugin(p)` | Bootstrap a sub-plugin from inside this one |
| `unregisterPlugin(name)` | Tear down a previously-registered sub-plugin |
| `t(key, vars?)` | Localized message lookup with `{var}` substitution |

## Pattern 1 — register a custom command

The most common plugin use case. Wrap a multi-step mutation
so the user can undo it with one Ctrl+Z.

```ts
import { definePlugin, type IPluginContext } from '@monbolc/lowcode-shell';

export default definePlugin({
  name: '@acme/sapu-save-indicator',
  init(ctx: IPluginContext): void {
    // A custom command with no-op undo (commands always need
    // a way to revert; here the revert is "do nothing
    // visible" — see Pattern 2 for a real example).
    ctx.commands.register({
      name: 'acme.mark-dirty',
      execute() { document.title = '● ' + document.title; return null; },
      undo() { document.title = document.title.replace(/^●\s/, ''); },
    });
  },
});

// Outside the engine:
await engine.commands.execute('acme.mark-dirty');
await engine.commands.undo();
```

For commands that mutate the document, the built-in
`@sapu/builtin-document-commands` plugin (registered by
`createDefaultPlugins()`) already covers `document.insert`,
`document.remove`, `document.move`, `document.setProp`,
`document.rename` — your plugin doesn't need to re-implement
those.

## Pattern 2 — a real command that mutates a node

When your command needs to remember state for undo, capture
it at execute time and use it in undo. Ali-faithful:

```ts
import { definePlugin, type IPluginContext } from '@monbolc/lowcode-shell';
import { type Node } from '@monbolc/lowcode-designer';

export default definePlugin({
  name: '@acme/sapu-rename-with-tag',
  init(ctx: IPluginContext): void {
    let prevName: string | null = null;
    ctx.commands.register({
      name: 'acme.rename-with-tag',
      execute(args: { nodeId: string; tag: string }) {
        const node: Node | undefined = ctx.project.document.getNode(args.nodeId);
        if (!node) return null;
        prevName = node.componentName;
        // ... mutate via project.document, return the new name
        return node.componentName;
      },
      undo(args, _returnValue) {
        const node = ctx.project.document.getNode(args.nodeId);
        if (node && prevName) {
          // restore — DocumentModel.rename is the public path
          ctx.project.document.rename(node, prevName);
        }
      },
    });
  },
});
```

The `args` shape is generic per command — pick whatever
makes the call site ergonomic. The return value from
`execute` is passed to `undo` as the second arg, so capture
anything `undo` needs in the closure (the return value is
cheap, but closures are clearer for multi-field state).

## Pattern 3 — wire a keyboard shortcut

Plugins don't get a "register shortcut" method. Use a plain
document-level `keydown` listener gated on the focused
element. The shell's own `setupReactRenderer` and BaseUI
inputs already preventDefault on some keys, so check
`e.defaultPrevented` first.

```ts
export default definePlugin({
  name: '@acme/sapu-shortcut-pack',
  init(ctx: IPluginContext): void {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 's') {
        e.preventDefault();
        void ctx.commands.execute('acme.save');
      }
    };
    document.addEventListener('keydown', onKey);
    // Track for destroy().
    return () => document.removeEventListener('keydown', onKey);
  },
  destroy() {
    // (the cleanup returned by init isn't auto-called by the
    // shell — handle teardown explicitly here if your plugin
    // attaches anything at the document/window level)
  },
});
```

## Pattern 4 — listen to project events

`project.events` is an `Emitter` with a typed event map. The
canonical events for canvas mutations:

```ts
project.events.on('nodeAdded', (e) => { /* e.node, e.parent, e.index */ });
project.events.on('nodeRemoved', (e) => { /* e.node */ });
project.events.on('nodeMoved', (e) => { /* e.node, e.oldParent, e.newParent */ });
project.events.on('nodePropsChanged', (e) => { /* e.node, e.patch */ });
project.events.on('rootChanged', (e) => { /* e.root */ });
project.events.on('selectionChanged', (e) => { /* e.selectedIds */ });
```

Don't forget to remove your listener in `destroy()` — the
shell won't GC event listeners automatically.

## Pattern 5 — host a custom setter

Setters are pure data: a `SetterDescriptor` (string-typed
vdom) the L4 settings panel resolves to a React component.
A custom setter is just a component registered in the global
registry.

```ts
import { definePlugin, type IPluginContext } from '@monbolc/lowcode-shell';
import { type SetterComponent } from '@monbolc/lowcode-plugin-setters';

const HexColor: SetterComponent = ({ value, onChange }) => ({
  type: 'Input',  // any built-in or your own
  props: {
    className: 'w-full px-2 py-1 text-xs font-mono',
    value: typeof value === 'string' ? value : '0x000000',
    onChange: (e: { target: { value: string } }) => onChange('0x' + e.target.value.replace(/^0x/, '')),
  },
});

export default definePlugin({
  name: '@acme/sapu-hex-setter',
  init(ctx: IPluginContext): void {
    // 'registerSetter' is a global side-effect — call it once.
    import('@monbolc/lowcode-plugin-setters').then((m) => {
      m.registerSetter('HexColor', HexColor);
    });
  },
});
```

Then in your host config, opt a (componentName, propName)
into your setter:

```ts
const engine = await init('#editor', {
  schema,
  components: {},
  setterConfig: {
    MyColorComponent: { color: 'HexColor' },
  },
});
```

## Pattern 6 — bind a DOM element as a drag source (v2.3)

The public Dragon facade exposes `dragon.from(shell, toDragObject)`
— the ali-faithful way to wire a palette row or a sidebar
item as a drag source. The facade installs its own `mousedown`
listener and takes over from there.

```ts
import { definePlugin, type IPluginContext } from '@monbolc/lowcode-shell';

export default definePlugin({
  name: '@acme/sapu-floating-palette',
  init(ctx: IPluginContext): void {
    // For every element matching '.palette-item', install a
    // mousedown handler that produces a NodeData DragObject.
    document.querySelectorAll<HTMLElement>('.palette-item').forEach((el) => {
      const componentName = el.dataset.component;
      if (!componentName) return;
      const dispose = ctx.dragon.from(el, () => ({
        type: 'NodeData',
        data: { componentName },
      }));
      // Track the disposer (the shell doesn't auto-dispose
      // for dynamic elements — you own the lifecycle here).
      ctx.dragon; // (intentional no-op to keep the type hint visible)
      // Stash `dispose` for cleanup, e.g. on `destroy()`.
    });
  },
});
```

For a node-sensor (drop target) implementation, see
`packages/designer/src/simulator-host.ts` — the BuiltinSimulatorHost
is a reference implementation. Custom sensors register via
`ctx.dragon.addSensor(sensor)`.

## Publishing your plugin

A plugin that lives in a host's codebase is fine. A plugin
that ships as a standalone npm package should follow the
workspace pattern:

1. **Name**: `@<your-scope>/sapu-<feature>` (e.g. `@acme/sapu-save-indicator`).
2. **Peer dependencies**: `@monbolc/lowcode-shell` for the
   `IPlugin` / `IPluginContext` types; whatever L3+ packages
   you touch (rare — most plugins only use the context).
3. **Versioning**: align with the engine's minor version.
   Plugins built against `@monbolc/lowcode-engine@2.2.x`
   should publish as `2.2.x` to keep the contract obvious.
4. **Public exports**: `export default definePlugin({ ... })`.
   The default export is what `engine.registerPlugin(p)` takes.
5. **Avoid `ali*` tokens in identifiers or comments** (per
   the project's naming convention; the comment in
   `packages/ignitor/src/bootstrap.ts` documents why).
6. **Test** with the demo's `examples/demo/` app — it's
   the canonical wiring reference. `yarn demo` to start it.

## Anti-patterns

- **Don't reach into `engine._private` from a plugin.** If
  you need a public surface that the shell doesn't expose,
  open a PR on `@monbolc/lowcode-shell` instead.
- **Don't `await` inside `init`.** The shell calls `init`
  synchronously; returning a Promise from `init` is ignored.
  Schedule async work via `ctx.events.on('engineReady', ...)`
  or by calling `queueMicrotask` / `requestAnimationFrame`.
- **Don't register the same plugin twice.** The shell
  throws on `registerPlugin` with a duplicate name.
- **Don't store state in module-scope closures that survive
  engine teardown.** If the host calls `destroy(engine)`,
  your module-level state stays in memory but the engine
  is gone. Stash state on the engine (via a `WeakMap` keyed
  on the engine instance) or in a class field.

## See also

- `docs/HANDOVER.md` — current state, conventions, v2.2.0 publish steps.
- `docs/packages/shell.md` — the `IPlugin` / `IPluginContext` source.
- `docs/packages/designer.md` — DocumentModel, Project, Dragon, the document commands.
- `docs/packages/plugin-command.md` — `ICommand` / `CommandManager` contract.
- `docs/ARCHITECTURE.md` — L0–L7 layering, the plugin lifecycle.
