# `@monbolc/lowcode-designer` (L3)

> **Version**: 2.0.3 · **Uses adapter for React (does not import React)** · **30+ tests** · **⚠️ 1 typecheck error**

## Purpose

The design-time model: `Project`, `DocumentModel`, `Node` tree, `Simulator` (preview), `Dragon` (drag-and-drop), 5 commands (Insert/Remove/Move/SetProp/Rename), DOM utilities for hit-testing.

The heart of the editor's mutation layer.

## Public exports

### Classes
- `DocumentModel` + `IDocumentModel` interface
- `Node` — schema wrapper (lightweight, non-caching)
- `Project` + `ProjectEvents` (re-emits DocumentEvents + DragonEvents + selection)
- `Dragon` + `DragonEvents` + `DragonState` + `DropTarget`
- `Simulator` + `SimulatorOptions` (preview mode; wraps `ReactRenderer`)

### Commands
- `InsertCommand`, `RemoveCommand`, `MoveCommand`, `SetPropCommand`, `RenameCommand`
- All implement `ICommand` from `@monbolc/lowcode-plugin-command` and integrate with the `CommandManager`'s undo/redo

### DOM utilities
- `getRect`, `rectsOverlap`, `rectContains`, `rectMidpoint`
- `findNodeIdFromElement`, `tagElementWithNodeId`
- `hitTest`, `getHitInfo`

### Types
- `Rect` — `{ x, y, width, height }`
- `HitInfo` — `{ hitId: string | null, relativeY: number, height: number }`
- `DocumentEvents`, `ProjectEvents`, `DragonEvents`, `SimulatorOptions`

## Key types

```ts
interface IDocumentModel {
  events: DocumentEvents;
  root: IPublicTypeNodeSchema;
  nodes: Map<string, Node>;
  setRoot(schema: IPublicTypeNodeSchema): void;
  getNode(id: string): Node | undefined;
  insert(node: IPublicTypeNodeSchema, parentId: string | null, index: number): void;
  remove(id: string): void;
  setProps(id: string, props: Record<string, JSONValue>): void;
  rename(id: string, newName: string): void;
  move(id: string, newParentId: string, newIndex: number): void;
}

interface DropTarget {
  parentId: string | null;
  index: number;
  placement: 'before' | 'after' | 'inside';
}
```

## Implementation patterns

- **`Simulator`** wraps `ReactRenderer` and uses `adapter.getRuntime().createElement` (the `h()` resolver). It's the "preview" mode.
- **Commands implement `ICommand`** from `plugin-command`. `SetPropCommand` is `mergeable: true` with `mergeWindowMs: 300` and stores the previous value in `returnValue` so undo restores the pre-window value. `RemoveCommand` and `MoveCommand` capture a snapshot at execute time (via `JSON.parse(JSON.stringify(...))`).
- `DocumentModel.indexSubtree` walks the schema and assigns synthetic ids via `uid('n')` if the schema has no `key`. Returns the wrapper for the root of the subtree.
- `DocumentModel.move` does explicit unindex + reindex with the new parent ref so the wrapper's `parent` is correct.
- `Node.children` is a getter that **wraps each child in a fresh `Node` on every access** — explicitly noted as a "lightweight wrapper that defers resolution". To get full Node API, use `document.nodes`.
- **DOM utilities use `data-lce-id` attribute** as the node-id marker (set via `tagElementWithNodeId`, read via `findNodeIdFromElement`). `hitTest` uses `document.elementsFromPoint`.
- `Project.wireDocument()` re-emits every document and dragon event through the project's own bus, so consumers subscribe in one place.
- `_rootId` in OutlinePane is set to a random `root_<6char>` per schema.

## Test coverage

- 4 test files, 30+ tests
- `commands.test.ts` (7): Insert/Remove/Move/SetProp/Rename undo+redo, SetProp merge, end-to-end insert+edit+rename+3x undo
- `document.test.ts` (10): tree indexing, getNode, setRoot, insert/remove/setProps/rename/move events, Node accessors
- `drop.test.ts` (4): Dragon start/move/commit, drop event, cancel event, end-to-end drop moves the schema
- `project.test.ts` (10): Project document, select/selectMany/add/remove/clear, re-emit events, getSelectedNodes, Dragon state, DOM utils

## External deps

- `@monbolc/lowcode-types`, `@monbolc/lowcode-utils`, `@monbolc/lowcode-editor-core`, `@monbolc/lowcode-renderer-core`, `@monbolc/lowcode-react-renderer` (workspace)
- `react`, `react-dom` (optional peer)
- `react`, `react-dom`, `@types/react`, `@types/react-dom` (dev)

## ⚠️ Known issues

### P0.2 — `SetPropCommand.undo` type mismatch (1 error)

`packages/designer/src/commands.ts:133` — `Property 'undo' in type 'SetPropCommand' is not assignable to the same property in base type 'ICommand<{ nodeId, key, value: JSONValue }, JSONValue | undefined>'`. Likely needs `JSONValue | undefined` narrowing.

## Missing from upstream port

- `SettingTopEntry`/`SettingField` — these are L4+ work; setters are in `plugin-setters` (L2.5) but not yet wired
- `BuiltinSimulator` — the designer's iframe-based simulator host; deferred
- `Detecting` (hover), `Scroller` (scroll-into-view), `Clipboard` (cut/copy/paste) — see [../ROADMAP.md](../ROADMAP.md) P2.2
- `ComponentMeta` parser, `LowCodePluginManager` (the designer's own plugin manager) — see P2.2
- `BemTools` — dropped entirely (Fusion tooltips replaced with BaseUI in L4+, not yet built)

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — L3 design
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — upstream is 86 files, 15,225 lines; sapu is much slimmer
- [../packages/plugin-command.md](plugin-command.md) — what the 5 commands implement
- [../packages/editor-skeleton.md](editor-skeleton.md) — consumer of `Project`
