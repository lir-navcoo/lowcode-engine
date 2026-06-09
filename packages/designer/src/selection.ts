/**
 * @monbolc/lowcode-designer — document/selection
 * Ali-mirror Phase D.I7b-prep: the `Selection` class — the document-level
 * selection proxy.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/document/selection.ts`
 * (190 LoC ali → ~160 LoC slim). The `Selection` is owned by a
 * `DocumentModel` and tracks the set of selected node ids. Consumers
 * (BorderSelecting, BorderResizing, InsertionView, etc.) read it via
 * `doc.selection.has(id)` / `doc.selection.getNodes()` /
 * `doc.selection.getTopNodes()`.
 *
 * The slim port is the prerequisite for D.I7b's full BorderSelecting
 * port (D.I7 currently falls back to `host.project.selectedIds`).
 *
 * Slim translations applied:
 *   - `@obx.shallow private _selected: string[]` → `Observable<string[]>`
 *     (slim Observable-lite; the shallow-equivalent is the default
 *     for an Observable that holds a single array reference)
 *   - `IEventBus` / `createModuleEventBus` → `Emitter` (D.I2)
 *   - `makeObservable(this)` → drop (no decorators)
 *   - `INode.canSelect()` from ali → slim `Node` lacks this; the
 *     slim port defaults `canSelect` to `true` (any node can be
 *     selected). Ali-faithful `canSelect` is a Phase D-2 addition.
 *   - `comparePosition(a, b)` from ali's `PositionNO` enum → slim
 *     port uses `a.contains(b)` + identity (the getTopNodes algorithm
 *     is rewritten to use just `contains` + identity, no separate
 *     enum)
 */
import { Emitter, Observable } from '@monbolc/lowcode-utils';
import type { DocumentModel } from './document';
import type { Node } from './node';

/**
 * The `Selection` class. Ali-faithful 190-LoC port; the slim port
 * keeps the public surface 1:1 so D.I7b's BorderSelecting can swap
 * its `host.project.selectedIds` fallback for the real `doc.selection`.
 */
export class Selection {
  private readonly _emitter = new Emitter<{ selectionchange: string[] }>();
  private readonly _selected: Observable<string[]>;
  private readonly _doc: DocumentModel;

  constructor(doc: DocumentModel) {
    this._selected = new Observable<string[]>([]);
    this._doc = doc;
  }

  /** Read the currently-selected node ids (ali-faithful `get selected()`). */
  get selected(): string[] {
    return this._selected.get();
  }

  /**
   * Ali-faithful `select(id)`: replace the selection with a single id.
   * - Skips the emit if the selection is already `{id}` (avoid the
   *   no-op re-render fan-out)
   * - Skips if the id doesn't exist on the document OR the node's
   *   `canSelect()` returns false (slim: defaults to true)
   */
  select(id: string): void {
    const cur = this._selected.get();
    if (cur.length === 1 && cur.indexOf(id) > -1) return;
    const node = this._getNode(id);
    if (!node || !this._canSelect(node)) return;
    this._selected.set([id]);
    this._emitter.emit('selectionchange', [id]);
  }

  /**
   * Ali-faithful `selectAll(ids)`: replace the selection with a
   * filtered set (only ids whose node passes `canSelect()`).
   */
  selectAll(ids: string[]): void {
    const selectIds: string[] = [];
    for (const id of ids) {
      const node = this._getNode(id);
      if (node && this._canSelect(node)) selectIds.push(id);
    }
    this._selected.set(selectIds);
    this._emitter.emit('selectionchange', selectIds);
  }

  /** Ali-faithful `clear()`: empty the selection. No-op if already empty. */
  clear(): void {
    if (this._selected.get().length < 1) return;
    this._selected.set([]);
    this._emitter.emit('selectionchange', []);
  }

  /**
   * Ali-faithful `dispose()`: prune dangling ids (whose node no longer
   * exists in the document). Emits `selectionchange` if the pruning
   * actually changed the set.
   */
  dispose(): void {
    const cur = this._selected.get();
    const l = cur.length;
    const next: string[] = [];
    for (const id of cur) {
      if (this._getNode(id)) next.push(id);
    }
    if (next.length !== l) {
      this._selected.set(next);
      this._emitter.emit('selectionchange', next);
    }
  }

  /** Ali-faithful `add(id)`: append to the selection. No-op if already in. */
  add(id: string): void {
    const cur = this._selected.get();
    if (cur.indexOf(id) > -1) return;
    cur.push(id);
    this._selected.set(cur.slice());
    this._emitter.emit('selectionchange', cur.slice());
  }

  /** Ali-faithful `has(id)`: is the id in the selection? */
  has(id: string): boolean {
    return this._selected.get().indexOf(id) > -1;
  }

  /** Ali-faithful `remove(id)`: remove from the selection. No-op if absent. */
  remove(id: string): void {
    const cur = this._selected.get();
    const i = cur.indexOf(id);
    if (i < 0) return;
    cur.splice(i, 1);
    this._selected.set(cur.slice());
    this._emitter.emit('selectionchange', cur.slice());
  }

  /**
   * Ali-faithful `containsNode(node, excludeRoot)`: does the selection
   * contain a node that is `node` itself OR an ancestor of `node`?
   * - `excludeRoot=true` skips ancestors that contain `doc.focusNode`
   *   (i.e. skips the root when checking containment)
   */
  containsNode(node: Node, excludeRoot = false): boolean {
    const focusNode = (this._doc as unknown as { focusNode?: { contains(other: unknown): boolean } }).focusNode;
    for (const id of this._selected.get()) {
      const parent = this._getNode(id);
      if (!parent) continue;
      if (excludeRoot && focusNode && parent.contains(focusNode)) continue;
      if (parent.contains(node)) return true;
    }
    return false;
  }

  /** Ali-faithful `getNodes()`: return the selected nodes (skips dangling). */
  getNodes(): Node[] {
    const nodes: Node[] = [];
    for (const id of this._selected.get()) {
      const node = this._getNode(id);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  /**
   * Ali-faithful `getTopNodes(includeRoot)`: return the top-level
   * selected nodes (the algorithm: walk each selected, skip if its
   * ancestor is also selected, or if it IS the focus node / contains
   * the focus node).
   * Slim port: uses `contains()` for both the "focus-node check" and
   * the "ancestor check" (instead of ali's `comparePosition` enum).
   */
  getTopNodes(includeRoot = false): Node[] {
    const focusNode = (this._doc as unknown as { focusNode?: { contains(other: unknown): boolean } }).focusNode;
    const nodes: Node[] = [];
    for (const id of this._selected.get()) {
      const node = this._getNode(id);
      if (!node) continue;
      if (!includeRoot && focusNode && node.contains(focusNode)) continue;
      let isTop = true;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.contains(node) || n === node) {
          // n contains node (or is the same) — node is NOT top
          isTop = false;
          break;
        }
        if (node.contains(n)) {
          // node contains n — drop n (it was a deeper top)
          nodes.splice(i, 1);
        }
      }
      if (isTop) nodes.push(node);
    }
    return nodes;
  }

  /** Ali-faithful `onSelectionChange(fn)`: subscribe to selection changes. */
  onSelectionChange(fn: (ids: string[]) => void): () => void {
    this._emitter.on('selectionchange', fn);
    return () => this._emitter.off('selectionchange', fn);
  }

  // ---- Slim private helpers ----

  /**
   * Read the node by id. Ali-faithful: `this.doc.getNode(id)`.
   */
  private _getNode(id: string): Node | undefined {
    return (this._doc as unknown as { getNode: (id: string) => Node | undefined }).getNode(id);
  }

  /**
   * Slim `canSelect` default. Ali-faithful: `node.canSelect()`.
   * The slim `Node` doesn't have `canSelect` yet (Phase D-2 widens);
   * the slim port defaults to `true` (any node can be selected).
   */
  private _canSelect(_node: Node): boolean {
    return true;
  }
}
