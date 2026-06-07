# `@monbolc/lowcode-ignitor` (L0)

> **Version**: 2.0.0 · **React-free** · **0 test files** · **Placeholder only**

## Purpose

The bootstrap entry point. Currently a placeholder that injects a "L0 bootstrap ready" banner into the container. The real composition root will live in the future `@monbolc/lowcode-engine` (L7) package.

## Public exports

```ts
async function bootstrap(options: IPublicEngineOptions): Promise<IIgnitorContext>;
interface IIgnitorContext {
  container: HTMLElement;
  engine?: IPublicApiEngine;   // future: real engine instance
  hooks?: { /* future: hot-reload hooks */ };
}

// Type re-exports
type { IPublicApiEngine, IPublicEngineOptions };
```

## Implementation patterns

- Plain `async function`; uses `innerHTML` to inject a centered "SapuLowcodeEngine — L0 bootstrap ready" banner
- String-or-`HTMLElement` resolution: `typeof options.container === 'string' ? document.querySelector : options.container`
- Includes a `scripts/dev.js` placeholder that `console.log`s a banner (so `yarn workspace @monbolc/lowcode-ignitor start` works)

## Build

- Only `build` script (no `build:es`) — ships CJS only
- Output: `lib/index.js` (and `module: lib/index.js`)
- Standalone `tsconfig.json` (NOT extending root) to keep `lib/` flat — root `paths` would otherwise force tsc to follow the workspace symlink to `packages/types/src/` and produce nested `lib/ignitor/`, `lib/types/` output

## Test coverage

- **0 tests** — no `tests/` directory. Coverage gap. (See [../ROADMAP.md](../ROADMAP.md) P1.2.)

## External deps

- `@monbolc/lowcode-types` (workspace)
- `@types/node` (dev)

## Notes

- L0 placeholder; deliberately a no-op so the package shape is committed and L7+ can wire into it
- This is the equivalent of `ali-lowcode-engine/packages/ignitor/` (which is **also** a placeholder/scaffold, not a published package — it's the demo launcher that bundles `engine` + `react-simulator-renderer` into UMD scripts)

## See also

- [../ROADMAP.md](../ROADMAP.md) — L7 plan that will replace this
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — what `ali/ignitor/` does differently (UMD demo launcher)
