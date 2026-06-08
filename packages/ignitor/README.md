# `@monbolc/lowcode-ignitor` — **DEPRECATED**

> ⚠️ **This package is deprecated as of 2026-06-08 (v2.2.0-rc).** The `bootstrap()` function still works but prints a deprecation warning to the console. The package will be **removed in 2.3.0**.

## Use `@monbolc/lowcode-engine` instead

```ts
// ❌ Old way (still works, but warns)
import { bootstrap } from '@monbolc/lowcode-ignitor';
await bootstrap({ container: '#app', schema, components });

// ✅ New way
import { init } from '@monbolc/lowcode-engine';
const engine = await init('#app', { schema, components });
```

`@monbolc/lowcode-engine` is the L7 composition root. It re-exports `SapuEngine` (L6), wires the default preset (L7.4), and provides a real `init(container, options)` that returns the live engine.

## Why was this deprecated?

`lowcode-ignitor` was an L0 placeholder created in v2.0.x to fill the spot the L7 engine would eventually own. Once L7 ships, the placeholder becomes a maintenance burden (two packages doing the same job). The L7 `init()` is a strict superset of `ignitor.bootstrap()`, so the migration is a one-line import change.

## When will it be removed?

2.3.0 (target: end of June 2026). The package will be unpublished from npm and the directory deleted. If your project still imports from `@monbolc/lowcode-ignitor`, upgrade before then.

## See also

- `@monbolc/lowcode-engine` — the replacement
- `docs/packages/ignitor.md` — full deprecation timeline
- `docs/ROADMAP.md` — L7.6 entry
