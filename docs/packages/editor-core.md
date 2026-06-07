# `@monbolc/lowcode-editor-core` (L2)

> **Version**: 2.0.0 · **React-free** · **No MobX** · **27 tests**

## Purpose

The composition root's L2 counterpart: DI container, i18n, plugin manager, the `Editor` event-bus, and the `CommandManager` re-export. This is the package that all plugins depend on (transitively via `plugin-command` for commands).

## Public exports

### Types
- `EditorEvents`, `EditorPhase`, `IEditor`
- `I18n`, `I18nMessage`
- `IPlugin`, `IPluginContext`, `IPluginManager`
- `ServiceFactory` (alias for `Factory<T>`)

### Classes
- `DIContainer` — keyed DI container (singleton / transient scope; async `get`, sync `peek`)
- `I18nImpl` — i18n with string shorthand (`'foo': 'Hello'` is normalized to `{ default: 'Hello' }`)
- `PluginManager` — topological sort with cycle detection; result cached + invalidated on register/unregister
- `Editor` — composition root; init/destroy lifecycle; fires 3 phases (`init`, `register`, `ready`)

## Key types

```ts
interface IEditor {
  events: EditorEvents;          // 'init' | 'register' | 'ready' | 'destroy'
  init(): Promise<void>;
  destroy(): Promise<void>;
  ready: Promise<void>;
  get<T>(ctor: Factory<T>): Promise<T>;
  peek<T>(ctor: Factory<T>): T | undefined;
}

interface IPluginContext {
  editor: IEditor;
  i18n: I18nImpl;
  di: DIContainer;
  events: EditorEvents;
  plugins: PluginManager;
  commands: CommandManager;     // re-exported from plugin-command
}

interface IPlugin {
  name: string;                 // validated: /^[A-Za-z0-9_@./\-]+$/
  dependencies?: string[];
  init?(ctx: IPluginContext): void | Promise<void>;
  destroy?(ctx: IPluginContext): void | Promise<void>;
}
```

## Implementation patterns

- **Custom DI container** (no InversifyJS / tsyringe) — small surface; async factories can call `get` for their own deps
- `DIContainer.register(ctor, factory, scope)` — the ctor IS the lookup key
- `Editor.init` rejects a second `init()` call
- `Editor.destroy` fires `destroy`, runs plugins in reverse, clears DI, clears command history
- Plugin name validation regex: `/^[A-Za-z0-9_@./\-]+$/`
- Topological sort uses a `visiting` set to throw "circular dependency" errors with the offending name

## Test coverage

- 4 test files, 27+ tests: `di.test.ts` (8), `editor.test.ts` (5), `i18n.test.ts` (8), `plugin.test.ts` (10)
- Covers: singleton, transient, dup registration, peek, factory-dep, phase order, dep sort, missing dep, circular detection, init/destroy lifecycle, init-twice rejection, destroy-no-init, missing-locale fallback, default, per-call, shorthand, size, plugin dup, invalid name

## External deps

- `@monbolc/lowcode-types` (workspace)
- `@monbolc/lowcode-utils` (workspace)
- `@monbolc/lowcode-plugin-command` (workspace)
- No React, no MobX

## Notable

- The `ServiceFactory<T>` is a re-export of `Factory<T>` — same thing, friendlier name for plugin authors
- The `lib/index.d.ts` mentions "mobx / react-redux" in a JSDoc comment as the alternative to the in-house `Emitter`/`useRev` approach. This is the **only** mention of mobx in any source/test file and it's used rhetorically

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — "No MobX" decision rationale
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — what's dropped from `ali/editor-core/` (obx facade, widgets/tip, power-di, intl-messageformat, store, lodash.get)
