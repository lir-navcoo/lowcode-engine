# `@monbolc/lowcode-utils` (L1)

> **Version**: 2.0.2 · **React-free** · **Pure utilities** · **76 tests**

## Purpose

Pure runtime helpers. Tree-shakeable functions plus two classes (`Emitter`, `ConsoleLogger`). No side effects on import. The most-consumed package in the repo (8 inbound deps).

## Public exports

### Types
- `Nil`, `Primitive`, `PlainObject`, `DeepReadonly`, `DeepPartial`, `NonEmptyArray`, `ValueOf`

### ID generation (`id.ts`)
- `uid(prefix?: string): string` — RFC 4122 v4 via `crypto.getRandomValues`; default prefix `lce_`
- `seqId(prefix?: string): string` — timestamp + counter
- `resetSeqCounter(): void` — for deterministic tests

### Object helpers (`object.ts`)
- `isPlainObject`, `isNil`
- `deepClone` — **deliberately** does NOT use `structuredClone`; class instances pass through unchanged
- `isEqual` — treats `NaN === NaN` as true; special-cases `Date` and `RegExp`
- `merge`, `pick`, `omit`

### Path utilities (`path.ts`)
- `parsePath`, `getByPath`, `setByPath`, `deleteByPath`
- Dotted path with bracket notation; `a[0].b` ↔ `a.0.b` conversion
- `setByPath` creates intermediate objects OR arrays (whichever is needed based on next segment)

### Event emitter (`emitter.ts`)
- `Emitter<E extends EventMap = EventMap>` — typed pub/sub class
- API: `on`, `once`, `off`, `emit`, `removeAllListeners`, `listenerCount`
- Once-handlers self-remove during iteration (over a copy of the array)
- Errors thrown by handlers are swallowed + logged
- Types: `EventHandler`, `EventMap`

### Logger (`logger.ts`)
- `Logger` interface, `ConsoleLogger` class
- `getLogger()` / `setLogger()` singletons
- `Logger.child(tag, fields)` returns a `PrefixedLogger` decorator
- Types: `LogLevel`, `ConsoleLoggerOptions`

### Type guards (`guards.ts`)
- `isJSONValue`, `isNodeSchema`, `isRootSchema`, `isNodeData`, `isComponentSchema`, `isFieldConfig`, `isEventConfig`, `isActionContent`, `isDataSource`

## Implementation patterns

- All utility functions are pure and tree-shakeable
- `deepClone` deliberately passes class instances through unchanged (returns the same reference); this is the opposite of `structuredClone` behavior
- `isEqual` uses `a !== a && b !== b` for NaN detection

## Test coverage

- 6 test files, 76 tests across `emitter`, `guards`, `id`, `logger`, `object`, `path`
- Comprehensive: level filtering, child loggers, NaN equality, deep clone of Map/Set/Date/RegExp, path parsing edge cases (`a[0].b`, `a..b`, empty), all 8 type guards

## External deps

- `@monbolc/lowcode-types` (workspace)

## Notable bugs found and fixed by tests (4 total in the early L0/L1 phase)

1. `deepClone` over-eager cloning (used `structuredClone()` which cloned class instances)
2. `logger` inconsistent arg count (omitted `undefined` second arg)
3. `setByPath` ignored numeric segments (`arr[0].x` created `{arr: {'0': {x: 1}}}` instead of `{arr: [{x: 1}]}`)
4. `view.tsx` captured `createElement` at module load (fixed in `plugin-outline-pane` L2-D)

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — L1 design principles
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — what was dropped from `ali/utils/` (cursor, app-helper, context-menu, asset loader, lodash, mobx, prop-types, @alifd/next)
