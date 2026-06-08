# `@monbolc/lowcode-ignitor` (L0) — **DEPRECATED 2026-06-08**

> ⚠️ **DEPRECATED** in v2.2.0-rc. Use `@monbolc/lowcode-engine` (L7) instead. The `ignitor` package is kept as a shim that prints a deprecation warning and falls through to the L0 banner. Will be **removed in 2.3.0**.

## Migration

```ts
// ❌ Old (still works, but warns)
import { bootstrap } from '@monbolc/lowcode-ignitor';
await bootstrap({ container: '#app', schema, components });

// ✅ New
import { init } from '@monbolc/lowcode-engine';
const engine = await init('#app', { schema, components });
```

`@monbolc/lowcode-engine` is a strict superset: same async signature, same `container` semantics, same `schema` + `components` options, plus the full L6 surface (`SapuEngine`, plugin registry, event bus, i18n, ErrorBoundary).

## Purpose (historical)

The bootstrap entry point. Was a placeholder that injected a "L0 bootstrap ready" banner into the container, originally scoped to be replaced by L7 once it shipped. **L7 shipped 2026-06-08**; this package is now a deprecation shim only.

## Public exports (frozen)

```ts
async function bootstrap(options: IPublicEngineOptions): Promise<IIgnitorContext>;
interface IIgnitorContext {
  container: HTMLElement;
  engine?: IPublicApiEngine;   // never assigned in the shim
  hooks?: { /* never assigned in the shim */ };
}

// Type re-exports
type { IPublicApiEngine, IPublicEngineOptions };
```

`bootstrap()` is preserved for backward compatibility. On first call it prints `[lowcode-ignitor] DEPRECATED in 2.2.0. Use \`import { init } from "@monbolc/lowcode-engine"\` instead. The ignitor package will be removed in 2.3.0.` to `console.warn`. Subsequent calls in the same session are silent.

## Build

- Only `build` script (no `build:es`) — ships CJS only
- Output: `lib/index.js` (and `module: lib/index.js`)

## Test coverage

- **6 tests** in `packages/ignitor/tests/bootstrap.test.ts` — pin the shim's behavior (banner present, container resolution, missing-container error, theme option, default export).

## See also

- [`engine.md`](./engine.md) — the replacement
- [`shell.md`](./shell.md) — the L6 facade that `init()` returns
- [`../ROADMAP.md`](../ROADMAP.md) — L7.6 deprecation entry
- [`../COMPARISON-WITH-ALI.md`](../COMPARISON-WITH-ALI.md) — what `ali/ignitor/` does differently (UMD demo launcher)

