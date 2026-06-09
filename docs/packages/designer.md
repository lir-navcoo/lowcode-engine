# `@monbolc/lowcode-designer` (L3)

> **Version**: 2.27.0 · **Uses adapter for React (does not import React)** · **300+ unit tests / 30+ files** · **0 typecheck errors** · **Phase A + B + C.X + C.Y + C.Z + C.AA + C.AB + C.AC + C.AD + C.AE + D + D.I7b.1-13 ali-mirror done**

## Purpose

The design-time model: `Project`, `DocumentModel`, `Node` tree, `Simulator` (preview), `Dragon` (drag-and-drop), 8 commands (Insert/Remove/Move/SetProp/Rename/Detecting/Scroller/Clipboard), DOM utilities for hit-testing.

The heart of the editor's mutation layer.

## Public exports

### Classes
- `DocumentModel` + `IDocumentModel` interface
- `Node` — schema wrapper (lightweight, non-caching)
- `Project` + `ProjectEvents` (re-emits DocumentEvents + DragonEvents + selection)
- `Dragon` + `DragonEvents` + `DragonState` + `DropTarget`
- `Simulator` + `SimulatorOptions` (preview mode; wraps `ReactRenderer`)
- `BuiltinSimulatorHost` + `SimulatorHostOptions` (Phase C wires `computeComponentInstanceRect`)
- `DragResizeEngine` + `computeResize` + `ResizeAnchor` (8-anchor resize, P9)
- `ActiveTracker` + `ActiveTrackerEvents` (v2.4 P23 — single-focus concept)
- `Detecting<TNode>` + `DetectingEvents` (Phase B ali-mirror — hover tracker)
- `OffsetObserver` + `createOffsetObserver` + `IViewportLite` + `NodeInstanceRef` (Phase B — DOM-rect observer with `requestIdleCallback`)
- `Clipboard` + `domClipboard` (default singleton) + `DomClipboardPayload` + `ClipboardEvents` (Phase B — DOM-bridge clipboard via hidden-textarea + `execCommand`)

### Commands
- `InsertCommand`, `RemoveCommand`, `MoveCommand`, `SetPropCommand`, `RenameCommand`, `DetectingCommand`, `ScrollerCommand`, `ClipboardCommand`
- All implement `ICommand` from `@monbolc/lowcode-plugin-command` and integrate with the `CommandManager`'s undo/redo

### Scroller / Viewport extensions
- `Scroller.setSensitive(s)` / `getSensitive()` — Phase B ali-faithful; disable auto-scroll without tearing down
- `Scroller.detectBounds(x, y)` → `{ x, y }` — edge-threshold delta; plugins can ask "would scrolling fire?"
- `Scroller.autoScroll(dx, dy)` — re-arm rAF with explicit delta
- `Viewport.contentBounds` — scale-aware content rect (Phase B; consumed by `isDOMNodeVisible` in `utils/misc.ts`)
- `Viewport.setScale(s)` / `scale` — Phase C will wire for zoom controls

### Pure helpers (Phase B ali-mirror)
- `utils/invariant.ts` — `invariant(check, message, thing?)` → throws `[designer] Invariant failed: <message> in '<thing>'`
- `utils/misc.ts` — `isElementNode`, `isDOMNodeVisible(domNode, viewport)`, `normalizeTriggers(triggers)` (dropped `makeEventsHandler` — no iframe in sapu)
- `utils/tree-walk.ts` — `getClosestNode<T>(node, predicate)` + `TreeNodeLike<T>` (helper for clickable.ts; equivalent to ali's util)
- `builtin-simulator/utils/clickable.ts` — `getClosestClickableNode<TNode>(node, canClick, isLocked, event)` — walks up skipping locked + `!canClick`
- `builtin-simulator/utils/path.ts` — `isPackagePath`, `toTitleCase`, `generateComponentName`, `getNormalizedImportPath`, `makeRelativePath`, `resolveAbsoluatePath`, `joinPath`, `removeVersion`
- `builtin-simulator/utils/parse-metadata.ts` — `parseProps(component)`, `parseMetadata(component)`, `primitiveTypes` (10-entry ali-faithful list), `PropConfig`

### DOM utilities
- `getRect`, `rectsOverlap`, `rectContains`, `rectMidpoint`
- `findNodeIdFromElement`, `tagElementWithNodeId`
- `hitTest`, `getHitInfo`

### Types
- `Rect` — `{ x, y, width, height }`
- `HitInfo` — `{ hitId: string | null, relativeY: number, height: number }`
- `DocumentEvents`, `ProjectEvents`, `DragonEvents`, `SimulatorOptions`
- `DomClipboardPayload` — DOM-bridge clipboard payload (renamed from `ClipboardPayload` to disambiguate from `commands.ts`'s schema-level `ClipboardPayload`)
- `TreeNodeLike<T>`, `PropConfig`

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

interface IViewportLite {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  scale: number;
  scrolling: boolean;
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
- **Phase B Detecting** uses plain class fields + `Emitter<DetectingEvents>` (no MobX). `enable` flag clears the current node when set to `false`. `equals` predicate defaults to `===`; ali's `comparer.shallow` is replaced by a user-supplied predicate so the React layer can pass any equality (Phase D's `observerHOC`).
- **Phase B OffsetObserver** reads the rect from a `rectProvider: () => DOMRect | null` callback. Phase C wires this to `BuiltinSimulatorHost.computeComponentInstanceRect`. Root-mode observers skip the provider and read the viewport directly.
- **Phase B `getClosestClickableNode`** walks parents from SELF (not from `node.parent`) for the locked check — a node is blocked if it's locked OR has a locked ancestor. Ali's port comment says "locked ancestor (above the current node)" but the actual implementation walks from self; sapu matches the actual behavior so the test "skips a locked node + returns its parent" passes.
- **Phase B `parseProps`** does NOT depend on `prop-types`. It honors the `lowcodeType` annotation ali's setters write on `propTypes`; for unannotated `defaultProps` it infers from `typeof` (`boolean` → `bool`, `function` → `func`, `Array.isArray` → `array`, etc.).
- **Phase B `makeRelativePath`** treats the source as a FILE path (not a dir) — `makeRelativePath('/a/x', '/a/b/c')` is `'../../x'` (2 `..`s, not 1). Ali-faithful convention: import path comparison is between two files, not two dirs.

## Test coverage

- 13 test files, 180 unit tests, all passing in ~780ms
- `commands.test.ts` (18): Insert/Remove/Move/SetProp/Rename/Detecting/Scroller/Clipboard undo+redo, SetProp merge, end-to-end insert+edit+rename+3x undo
- `document.test.ts` (11): tree indexing, getNode, setRoot, insert/remove/setProps/rename/move events, Node accessors
- `drop.test.ts` (16): Dragon start/move/commit, drop event, cancel event, end-to-end drop moves the schema
- `project.test.ts` (11): Project document, select/selectMany/add/remove/clear, re-emit events, getSelectedNodes, Dragon state, DOM utils
- `simulator-host.test.ts` (30): BuiltinSimulatorHost lifecycle, document events, focus, props, sensor registration, leave-while-dragging
- `drag-resize.test.ts` (14): 8-anchor resize engine, MIN_SIZE, anchor-to-delta mapping
- `locate.test.ts` (14): three-mode insert-location compute (before/after/inside)
- `active-tracker.test.ts` (7): single-focus tracking, sibling switch, focusable predicate
- `dragon-generic.test.ts` (3): cross-cutting Dragon test
- **`utils-misc-invariant.test.ts` (10) — Phase B**: invariant truthy/falsy/optional-thing, isElementNode, isDOMNodeVisible (3 visibility cases), normalizeTriggers
- **`offset-observer-detecting.test.ts` (15) — Phase B**: createOffsetObserver null path, root-mode geometry, change event, rect provider, scale field, purge; Detecting enable/capture/release/leave/id-equality
- **`clipboard-scroller.test.ts` (11) — Phase B**: Clipboard textarea injection, setData event flow, no-copyPaster path, default singleton; Scroller sensitivity/detectBounds/autoScroll/rAF lifecycle
- **`b4-misc.test.ts` (20) — Phase B**: getClosestClickableNode 4 cases (self / locked-skip / canClick-skip / nothing), 12 path-helper cases, 5 parseProps/parseMetadata cases

## External deps

- `@monbolc/lowcode-types`, `@monbolc/lowcode-utils`, `@monbolc/lowcode-editor-core`, `@monbolc/lowcode-renderer-core`, `@monbolc/lowcode-react-renderer` (workspace)
- `react`, `react-dom` (optional peer)
- `react`, `react-dom`, `@types/react`, `@types/react-dom` (dev)

## Ali-mirror plan status

Per `~/.claude/plans/dynamic-marinating-rabbit.md`:
- **Phase A** ✅ done (`packages/utils/src/observable-lite.ts` + `throttle.ts` + 22 tests; committed `d2bfb81`)
- **Phase B** ✅ done (8 utility files + 4 test files; +56 tests, 510 → 566)
- **Phase C.X** ✅ done (computeComponentInstanceRect gap closed; +27 tests)
- **Phase C.Y** ✅ done (Viewport Observable-lite; +18 tests)
- **Phase C.Z** ✅ done (locate axis helpers; +33 tests)
- **Phase C.AA** ✅ done (OffsetObserver auto-subscribe; +8 tests)
- **Phase C.AB** ✅ done (autorun/reaction shims; +12 tests)
- **Phase C.AC** ✅ done (multi-instance rect union; +8 tests)
- **Phase C.AD** ✅ done (Dragon.chooseSensor with lastSensor; +13 tests)
- **Phase C.AE** ✅ done (HTML5 DnD branch; +10 tests). **Phase C COMPLETE.**
- **Phase D** ✅ done (10 commits: D.S1 + D.S2 + D.S3 + D.S4 + D.I2 + D.I3 + D.I6 + D.I7 + D.I8 + D.I9 = setting tree + bem-tools + simulator, ~5000 LoC)
- **Phase D.I7b.1** ✅ done (slim IDropLocation type + setDropLocation wiring in handleMove + real InsertionView port; +12 tests; designer 2.19.0 → 2.20.0)
- **Phase D.I7b.2** ✅ done (real NodeSelector port using BaseUI Popover; +6 tests; designer 2.20.0 → 2.21.0; file renamed node-selector-stub.tsx → node-selector.tsx)
- **Phase D.I7b.3** ✅ done (real BorderResizing port with 8-anchor handles reusing the existing DragResizeEngine; +6 tests; designer 2.21.0 → 2.22.0)
- **Phase D.I7b.4** ✅ done in editor-skeleton (DefaultDesignerView replaces Overlays with BemTools; editor-skeleton 2.3.0 → 2.4.0; 11 legacy overlays tests removed)
- **Phase D.I7b.6** ✅ done (BaseUI Tooltip replaces native `title` in border-selecting toolbar; ali-faithful delay=300/closeDelay=100; render prop keeps the `<div className="lc-borders-action">` shape. Also: BorderSelectingInstance now reads `hideSelectTools` via typed `getComponentMeta()`; BorderSelectingForNode synthesizes a single instance when `getComponentInstances` returns null; BorderSelectingRoot reads from `host.project.selectedIds` instead of `doc.selection.getNodes()` — single source of truth. +6 tests; designer 2.22.0 → 2.23.0)
- **Phase D.I7b.8** ✅ done (slim context menu port using BaseUI Menu compound; 7 default actions — Copy / Paste after / Cut / Duplicate / Insert sibling above / Insert sibling below / Delete — each calling the slim DocumentCommands. BuiltinSimulatorHost adds a `contextmenu` DOM listener that opens the menu on right-click of a `[data-lce-id]` element; BemTools root renders `<ContextMenu host state onClose>`; state lives in `host.contextMenuState` (slim Observable). +8 tests; designer 2.23.0 → 2.24.0)
- **Phase D.I7b.9** ✅ done (SettingTopEntry `setValue` now emits `valuechange` event with the new value via the typed `Emitter<ISettingTopEntryEvents>`. New `onValueChange(fn) → disposer` subscription method on the public `ISettingTopEntry` surface. Closes the pre-existing TODO at the `setValue` line. The ali-faithful `metadataChange` event surface (S4) is preserved for back-compat. +5 tests; designer 2.24.0 → 2.25.0)
- **Phase D.I7b.11** ✅ done (LiveEditing `apply()` flow's keydown handler now handles Escape + Enter, closing the pre-existing TODO. Enter (no Shift) → save + exit (preventDefault stops the newline; saveAndDispose called directly for happy-dom robustness). Shift+Enter → no-op (allow newline). Escape → discard + exit (set `_save = undefined` before blur so the focusout cascade doesn't re-save). Slim delta: direct-call pattern (not blur-based) is more reliable in jsdom / happy-dom. +3 tests; designer 2.25.0 → 2.26.0)
- **Phase D.I7b.13** ✅ done (ResourceConsumer closes 2 pre-existing TODOs. (1) When `consume()` is called with a renderer but no ctor-supplied `consumer` function, slim port now throws `ReferenceError` (was silent no-op). Plain-function consumers are unaffected (throw is gated on the renderer path only). (2) The `consume()` autorun's `await consumer(data)` is now wrapped in try/catch + `console.error('[lowcode-designer] ResourceConsumer: consumer threw:', err)` + emits the error on the typed `error` channel (the Emitter is now typed as `Emitter<{ error: unknown }>`). +2 tests; designer 2.26.0 → 2.27.0)

## Out of scope (deferred from Phase D + D.I7b)

- **D.I7b.next**: NodeSelector click → `host.project.select(parentId)` (covered by e2e, not unit)
- **D.I7b.next**: BaseUI Tooltip replacement (currently uses native `title` attribute)
- **D.I7b.next**: Real `BorderContainer` reactive container (D.I9 stub; full ali-faithful port requires additional Phase E Asset work)
- **Phase E**: full BaseUI Menu/Modal/Toast migration for plugin UIs (asset pipeline for icons)
- **Phase E**: full iframe-mode simulator (sapu has no iframe; `create-simulator.ts` ali-faithful port is not on the slim roadmap)

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — L3 design
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — upstream is 86 files, 15,225 lines; sapu is much slimmer
- [../packages/plugin-command.md](plugin-command.md) — what the 5 commands implement
- [../packages/editor-skeleton.md](editor-skeleton.md) — consumer of `Project`
