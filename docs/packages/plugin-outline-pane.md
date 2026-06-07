# `@monbolc/lowcode-plugin-outline-pane` (L2)

> **Version**: 2.0.2 · **Uses `react-arborist`** · **20 tests**

## Purpose

The left-side outline tree. The data model (`OutlinePane`, `schemaToTreeNodes`) is framework-agnostic; the view (`OutlineView`) uses `react-arborist` for virtualization. This replaces the upstream's hand-rolled recursive `Tree`/`TreeNode` (1 of 2 reasons the rewrite is so much smaller).

## Public exports

### Classes & interfaces
- `OutlinePane` class + `IOutlinePane` interface
- `OutlinePaneEvents` — `schemaChanged, selectionChanged, expansionChanged, renamed`

### Pure functions (`tree.ts`)
- `schemaToTreeNodes(schema)` — flattens schema into `ITreeNode[]` with cross-references; auto-expands first 2 depth levels
- `findNode`, `defaultOpenIds`

### React component
- `OutlineView` + `OutlineViewProps` + `RowHelpers`
- `RowHelpers`: `isSelected, isExpanded, toggle(), select(modifiers)`

### Plugin factory
- `createOutlinePanePlugin()` — returns an `IPlugin` that registers the pane in DI

### Types
- `ITreeNode` — flat-array representation: `id, componentName, title, icon?, depth, canHaveChildren, expanded, selected, dropTarget?, childrenIds, schema (back-ref), parentId`

## Key types

```ts
interface IOutlinePane {
  events: OutlinePaneEvents;
  nodes: ITreeNode[];
  selectedIds: string[];
  setSchema(schema: IPublicTypeNodeSchema): void;
  clear(): void;
  select(id: string, modifiers?: { shift?: boolean; meta?: boolean }): void;
  add(node: ITreeNode, parentId?: string, index?: number): void;
  remove(id: string): void;
  expand(id: string): void;
  collapse(id: string): void;
  toggle(id: string): void;
  rename(id: string, newName: string): void;
  getNode(id: string): ITreeNode | undefined;
}
```

## Implementation patterns

- **`h()()` resolver** in `view.tsx`: `const h = () => adapter.getRuntime().createElement as ...` — re-resolved on every render so consumers can install the runtime AFTER the module loads
- Uses `react-arborist`'s `Tree` for virtualization (important for large schemas — keeps `schemaToTreeNodes` flat)
- `usePaneRevision(pane)` hook — local `useState(0)` bumped on every pane event; **no MobX**
- Default row renderer uses inline `h()('div', {...}, [...])` calls instead of JSX (the file is named `.tsx` but the body is essentially h()() calls)
- Selection logic supports shift-click range-select between the last-selected and current id
- Uses `data-lce-id` attribute convention (with prefix `lce_` for ids)

## Test coverage

- 3 test files, 20 tests
- `api.test.ts` (9): setSchema, clear, select, add/remove, expand/collapse/toggle, expandAll/collapseAll, rename, isSelected
- `tree.test.ts` (5): flatten, depth, parentId, auto-expand, findNode, defaultOpenIds
- `view.test.tsx` (2): empty state, stub-runtime path

The view tests are intentionally smoke-only because react-arborist needs full layout; the real tree rendering is covered by the e2e tests in editor-skeleton.

## External deps

- `@monbolc/lowcode-types`, `@monbolc/lowcode-utils`, `@monbolc/lowcode-editor-core`, `@monbolc/lowcode-renderer-core` (workspace)
- `react-arborist` (runtime) — **first package to introduce this dep**
- `react`, `react-dom` (optional peer)

## Notable

- The 4th bug found and fixed by tests in the early phase: `view.tsx` captured `createElement` at module load. The `h()()` resolver pattern was introduced here and reused across all L3+ packages.

## See also

- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — what changed from `ali/plugin-outline-pane/` (31 files, 3120 lines, recursive Tree) to sapu (1 view file + `react-arborist`)
