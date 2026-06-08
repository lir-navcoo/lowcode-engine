# `@monbolc/lowcode-shell` (L6)

> **Version**: 2.2.0 · **21 tests / 4 files** · **~530 LoC** (vs upstream `engine-core` ~5,155)
>
> The host-facing facade. Sapu stance: **no proxies, no deprecation layer, no per-plugin scoped bus**. Plugins get a plain `IPluginContext` and the real engine references.

## Purpose

A single package that ties together L3 (Project), L4 (Skeleton), L5 (Workspace), the L6 event bus, the L6 i18n, the L6 ErrorBoundary, and the plugin registry into one class that the host can construct, mount into a DOM container, and tear down.

The shell is **React-free at the class level** — `SapuEngine` is pure TypeScript with no `import React`. The React boundary is `SapuErrorBoundary` (one component, used in the host's render tree).

## What ships in L6.2–L6.6

| Class / type | Lines | Purpose |
|---|---|---|
| `EngineEventBus` | ~75 | Typed wrapper over L1 `Emitter<EngineEvents>`. 7 event types: `engineReady`, `engineDestroyed`, `pluginRegistered`, `pluginUnregistered`, `pluginError`, `themeChanged`, `workspaceChanged`. |
| `SapuEngine` | ~180 | The host-facing facade. Owns the `Project`, the bus, the i18n, the plugin registry. Mounts once, destroys once, exposes the same `IPluginContext` to every plugin. |
| `ShellI18n` | ~95 | Map-based i18n with `{var}` regex substitution. 12 default messages in `locale/en-US.json` + 12 overrides in `locale/zh-CN.json`. Default locale is `zh-CN`. |
| `SapuErrorBoundary` | ~80 | React 19 `componentDidCatch` boundary. When `engine` prop is given, errors also fire `pluginError`. |
| `DefaultErrorFallback` | ~25 | Plain `<div role="alert">` with Tailwind classes — no BaseUI, no portal, no focus trap. |
| `definePlugin` (helper) | ~5 | Pure identity — runtime no-op, exists for DX. |

## Public exports

```ts
// Plugin contract
export interface IPlugin {
  name: string;                         // unique, [A-Za-z0-9_@./-]+
  init(context: IPluginContext): void;  // sync; throw = pluginError + unregister
  destroy?(): void;                     // optional, idempotent
}
export interface IPluginContext {
  project: Project;
  workspace?: Workspace;
  events: EngineEventBus;
  i18n: ShellI18n;
  registerPlugin(plugin: IPlugin): void;
  unregisterPlugin(name: string): void;
  t(key: string, vars?: Record<string, string | number>): string;
}
export function definePlugin<P extends IPlugin>(plugin: P): P;

// Event bus
export type EngineEventName =
  | 'engineReady' | 'engineDestroyed'
  | 'pluginRegistered' | 'pluginUnregistered' | 'pluginError'
  | 'themeChanged' | 'workspaceChanged';
export type EngineEvents = { /* see events.ts */ };
export class EngineEventBus { /* typed Emitter wrapper */ };

// Engine
export class SapuEngine implements ISapuEngine {
  readonly events: EngineEventBus;
  readonly i18n: ShellI18n;
  get plugins(): ReadonlyArray<IPlugin>;
  getProject(): Project;
  mount(options: MountOptions): Project;
  destroy(): void;
  registerPlugin(plugin: IPlugin): void;
  unregisterPlugin(name: string): boolean;
  hasPlugin(name: string): boolean;
  t(key: string, vars?: Record<string, string | number>): string;
}

// i18n
export type SupportedLocale = 'en-US' | 'zh-CN';
export class ShellI18n { /* see i18n.ts */ };
export const defaultLocale: 'zh-CN';
export const defaultMessages: I18nDictionary;
export function registerDefaultMessages(): I18nDictionary;

// Error boundary
export class SapuErrorBoundary extends Component<...> { /* React 19 */ };
export function DefaultErrorFallback({ error }: { error: Error }): ReactNode;
```

## Usage

The most common host wiring (the demo's `examples/demo/src/main.ts`):

```tsx
import { SapuEngine, SapuErrorBoundary, registerDefaultMessages } from '@monbolc/lowcode-shell';

const engine = useMemo(() => {
  const e = new SapuEngine();
  e.i18n.register(registerDefaultMessages());
  e.mount({ schema, components });
  return e;
}, []);

return (
  <SapuErrorBoundary engine={engine}>
    <Skeleton project={engine.getProject()} components={components} />
  </SapuErrorBoundary>
);
```

## Sapu stance: how this differs from ali

| | Sapu (sapu-lowcode-engine) | Ali (alibaba/lowcode-engine) |
|---|---|---|
| Engine class name | `SapuEngine` | `engine-core` (~5,155 LoC) |
| Plugin context | Plain object, real refs | `pluginContextApiAssembler.assembleApis` with reflection + deprecation wrappers |
| Per-plugin scoped bus | None — one bus per engine | One bus per plugin, with `eventPrefix` |
| Async plugin init | Sync only | Async (Promise) with topo sort |
| Init failures | Caught, `pluginError` fired, plugin removed | Caught, retried, logged |
| `i18n` | `ShellI18n` Map + `{var}` regex (95 LoC) | `intl-messageformat` with ICU plurals (full file) |
| Error boundary | `SapuErrorBoundary` (one class, 80 LoC) | Several `ErrorBoundary` wrappers per pane |

## Cross-references

- `SapuEngine.mount()` consumes `@monbolc/lowcode-designer`'s `Project` (L3).
- `IPluginContext.workspace` (optional) points to `@monbolc/lowcode-workspace` (L5).
- `SapuErrorBoundary` is the React 19 + Tailwind v4 boundary that wraps `<Skeleton>` in the demo.
- L7's `init(container, options)` in `@monbolc/lowcode-engine` is the entry point that the host should use for new integrations.

## Tests

`packages/shell/tests/`:

| File | Tests | Covers |
|---|---:|---|
| `sapu-engine.test.ts` | 4 | getProject-throws-before-mount, mount-creates-project, init-context-shape, plugin-throws-fires-pluginError |
| `i18n.test.ts` | 6 | current-locale string, setLocale flip, `{var}` substitution, missing-key-fallback, shorthand register, missing-var-no-crash |
| `plugin.test.ts` | 6 | definePlugin identity, context shape, duplicate name throws, invalid name throws, destroy() fires engineDestroyed, unregister invokes plugin.destroy |
| `error-boundary.test.tsx` | 5 | renders children, fallback on throw, custom fallback, pluginError event, DefaultErrorFallback render |

Total: **21 tests / 4 files / 100% pass**.
