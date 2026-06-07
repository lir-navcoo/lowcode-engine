# `@monbolc/lowcode-plugin-command` (L2)

> **Version**: 2.0.2 · **React-free** · **Pure logic** · **20 tests**

## Purpose

The command pattern + undo/redo + shortcut parsing. Pure logic, no React, no UI. Every L3+ command (in `designer`) implements `ICommand` and registers with a `CommandManager`.

## Public exports

### Types
- `CommandArgs`, `CommandResult`
- `CommandManagerEvents` — `registered, unregistered, executed, undone, redone, cleared`
- `ICommand<TArgs, TReturn>` — `name, label, group, shortcut, execute, optional undo, optional mergeable/mergeWindowMs`
- `ICommandManager`
- `CommandManagerOptions` — `historyLimit, autoMerge`
- `ParsedShortcut`, `ShortcutBinder`, `ShortcutBinderOptions`, `ShortcutToken`

### Functions
- `parseShortcut(input)` — supports `Mod` (Meta on macOS, Ctrl elsewhere), `Ctrl`, `Meta`, `Shift`, `Alt`. `Mod+Z` style.
- `bindShortcuts(manager, options)` — adds a global `keydown` listener; SSR-safe (no-op if `window` is undefined)
- `isMacOS()`

### Classes
- `CommandManager` (implements `ICommandManager`)

## Key types

```ts
interface ICommand<TArgs = unknown, TReturn = unknown> {
  name: string;
  label?: string;
  group?: string;
  shortcut?: string;
  execute(args: TArgs): TReturn | Promise<TReturn>;
  undo?(args: TArgs, returnValue: TReturn): void | Promise<void>;
  // Optional auto-merge for slider-style operations
  mergeable?: boolean;
  mergeWindowMs?: number;  // default 500
}
```

## Implementation patterns

- Uses `@monbolc/lowcode-utils`'s `Emitter` for events
- `CommandManager` keeps two stacks (`undoStack`, `redoStack`); a new `execute` clears the redo stack
- **Auto-merge**: when a command has `mergeable: true` and the top of the undo stack is the same name within `mergeWindowMs` (default 500ms), update the top's `args` in place (keeping the original `returnValue` so undo restores the pre-window state). Critical for `SetPropCommand` (slider drag).
- On undo/redo failure, the entry is restored to its original stack so the user can retry
- `unregister` also prunes in-flight history entries for that command name

## Test coverage

- 2 test files, 20 tests
- `manager.test.ts` (14): registration, undo, redo, merge windows, history limit, events, prune-on-unregister
- `shortcut.test.ts` (6): `parseShortcut` coverage

## External deps

- `@monbolc/lowcode-types` (workspace)
- `@monbolc/lowcode-utils` (workspace)

## See also

- [../packages/designer.md](designer.md) — the 5 commands that consume this
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — upstream `ali/plugin-command/` is a near-direct port (3 files, 564 lines)
