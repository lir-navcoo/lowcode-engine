# `@monbolc/lowcode-engine` (L7)

> **Version**: 2.1.4 · **18 tests / 2 files** · **~310 LoC** (vs upstream `engine` package ~1,330 — **~77% smaller**)
>
> The composition root. The ONE package a host installs to get a working visual editor. Sapu stance: **one `init()` call, not a chain of `register` calls**.

## Purpose

`sapu-lowcode-engine` is the meta-package that wires L0–L6 together into a single `init(container, options)` function. Hosts install only this package; the transitive deps pull in the rest of the stack.

The engine package does NOT introduce new functionality — it composes what L0–L6 already provide. The reason it exists as a separate package (rather than being rolled into L6 `shell`) is **dependency ergonomics**: a host can `yarn add @monbolc/lowcode-engine` and get everything, with no need to know which layer each piece lives in.

## What ships in L7

| Export | Lines | Purpose |
|---|---:|---|
| `init(container, options)` | ~80 | Async composition root. Sets up the React runtime, builds the engine, registers the preset, mounts the project, returns the live `ISapuEngine`. |
| `destroy(engine)` | ~10 | Tears down an engine + clears the host element. |
| `detectLocale()` | ~5 | Browser-default locale detection (`zh-CN` / `en-US`). |
| `createDefaultPlugins()` | ~50 | Returns the 3 built-in plugins (`@sapu/builtin-outline-pane`, `@sapu/builtin-settings-panel`, `@sapu/builtin-setters`). |
| `createDefaultPreset(overrides?)` | ~15 | Returns `{ plugins, locale, theme }`. Partial overrides merge on top of defaults. |
| `setTheme(name)` / `getTheme()` / `onThemeChange(fn)` | ~45 | Theme singleton backed by `document.documentElement.dataset.theme`. |
| L6 re-exports | — | `SapuEngine`, `SapuErrorBoundary`, `EngineEventBus`, `ShellI18n`, `definePlugin`, `registerDefaultMessages` + the matching types. Hosts don't need a second import. |

## Public API

```ts
import { init, destroy, detectLocale } from '@monbolc/lowcode-engine';

const engine = await init('#app', {
  schema: { componentName: 'Page', /* ... */ },
  components: { Page, Header, /* ... */ },
  preset: createDefaultPreset({ theme: 'dark' }),
  locale: 'en-US',
});

const project = engine.getProject();
engine.events.on('pluginError', ({ name, error }) => {
  console.warn('plugin failed:', name, error);
});

destroy(engine);
```

## Preset system

A preset is the `{ plugins, locale, theme }` triple. The default preset has:

```ts
{
  plugins: [
    { name: '@sapu/builtin-outline-pane',  init: () => {/* no-op; L4 mounts it */} },
    { name: '@sapu/builtin-settings-panel', init: () => {/* no-op; L4 mounts it */} },
    { name: '@sapu/builtin-setters',       init: () => registerBuiltInSetters() },
  ],
  locale: 'zh-CN',
  theme: 'light',
}
```

Hosts can override any field:

```ts
const preset = createDefaultPreset({
  plugins: [...createDefaultPlugins(), myCustomPlugin],
  theme: 'dark',
});
```

The `locale` flows into `engine.i18n.setLocale()`; the `theme` is stored for `getTheme()` consumers and the data-attribute is set on first render.

## Sapu stance: how this differs from ali

| | Sapu | Ali (alibaba/lowcode-engine) |
|---|---|---|
| Package name | `@monbolc/lowcode-engine` | `@alilc/lowcode-engine` |
| Entry point | `init(container, options)` | `init(options)` + `register()` chain |
| Default plugins | 3 (outline, settings, setters) | 7 (incl. context menu, save, snapshot) |
| Plugin async init | Sync only | Async with topo sort |
| UMD bundle | ❌ (CJS+ESM only) | ✅ `dist/engine.js` |
| Default CSS | None (host uses Tailwind) | `dist/engine.css` |
| Pre-registration via `window.ali*` globals | None | Yes |
| Bootstrap / handoff | `init()` returns engine | `init()` calls `setAsInstance` + emits `editorReady` |

**~77% smaller** because sapu drops:
- The UMD bundler config (5 files of webpack 4 setup)
- The auto-registration of 7 inner plugins
- The async init + topo sort
- The `window.aliLowcodeEngine` global
- The `setAsInstance`/`current` machinery

## Cross-references

- `init()` composes `@monbolc/lowcode-shell`'s `SapuEngine` (L6)
- `createDefaultPlugins()` wires `@monbolc/lowcode-plugin-setters` (L2.5)
- `init()` also calls `setupReactRenderer()` from `@monbolc/lowcode-react-renderer` (L3) as its first step
- See `examples/demo/src/main.ts` for a working end-to-end example
- See `docs/packages/shell.md` for the L6 surface `init()` returns
- See `docs/ROADMAP.md` L7.6 for the `@monbolc/lowcode-ignitor` deprecation timeline

## Tests

`packages/engine/tests/`:

| File | Tests | Covers |
|---|---:|---|
| `init.test.ts` | 7 | init returns engine, throws on missing container, throws on null container, engineReady fired, destroy tears down, detectLocale for non-English and English browsers |
| `preset.test.ts` | 11 | 3-unique-plugins, idempotent init, default preset shape, override merge, partial override, initial theme light, setTheme updates data attribute, setTheme notifies, setTheme same-name no-op, unsubscribe, throw on unknown name |

Total: **18 tests / 2 files / 100% pass**.
