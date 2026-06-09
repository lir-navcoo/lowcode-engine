/**
 * @monbolc/lowcode-designer — Node
 *
 * Ergonomic wrapper around a single schema node. Provides:
 * - Parent / children navigation
 * - Path access (e.g. `root.0.1.2`)
 * - Convenience accessors (id, depth, isLeaf)
 *
 * The wrapper does NOT cache state — every property reads from the
 * underlying schema so mutations by DocumentModel are immediately
 * visible.
 */

import type { IPublicTypeNodeSchema, JSONValue } from '@monbolc/lowcode-types';
import type { IComponentMetaLite } from './component-meta';

export class Node {
  readonly schema: IPublicTypeNodeSchema;
  readonly parent: Node | null;
  /**
   * Phase E.5: typed `componentMeta` slot. Ali-faithful: every node
   * reads `node.componentMeta` as a typed surface; the slim port
   * previously used structural casts (BorderDetecting / BorderSelecting
   * / BorderContainer all do `(node as any).componentMeta...`).
   * The slim port now exposes the typed `IComponentMetaLite` so the
   * bem-tool files can drop the casts.
   */
  private _componentMeta: IComponentMetaLite | null = null;

  constructor(schema: IPublicTypeNodeSchema, parent: Node | null) {
    this.schema = schema;
    this.parent = parent;
  }

  /** Wire the component meta (typically called by the host/project after Node creation). */
  setComponentMeta(meta: IComponentMetaLite | null): void { this._componentMeta = meta; }
  /** Read the wired component meta (or `null` if not yet wired). */
  getComponentMeta(): IComponentMetaLite | null { return this._componentMeta; }

  /** Stable id (the `key` field, or whatever DocumentModel assigned). */
  get id(): string {
    return this.schema.key as string;
  }

  /** Component name (e.g. "Button", "Page"). */
  get componentName(): string {
    return this.schema.componentName;
  }

  /** Props map (always returns an object, even if schema has none). */
  get props(): Record<string, JSONValue> {
    return this.schema.props ?? {};
  }

  /** Direct children wrapped as Node[]. */
  get children(): Node[] {
    // Children are wrapped on demand via the document's node map.
    // For correctness we need a reference back to the document, but
    // for now we return a lightweight wrapper that defers resolution.
    // (Consumers that need full Node API should iterate via document.nodes.)
    return (this.schema.children ?? []).map((child) => new Node(child, this));
  }

  /** Whether this node has any children. */
  get hasChildren(): boolean {
    return (this.schema.children?.length ?? 0) > 0;
  }

  /** Depth in the tree (root = 0). */
  get depth(): number {
    let d = 0;
    let p: Node | null = this.parent;
    while (p) {
      d += 1;
      p = p.parent;
    }
    return d;
  }

  /** True if the node has no children. */
  get isLeaf(): boolean {
    return !this.hasChildren;
  }

  /** Dotted path string: `root.0.1.2`. */
  get path(): string {
    const segs: string[] = [];
    let n: Node | null = this;
    while (n) {
      segs.unshift(n.componentName);
      n = n.parent;
    }
    return segs.join('.');
  }

  /**
   * Phase D.I7b-prep: `contains(other)` — true if `other` is `this`
   * or any descendant of `this`. Used by the new `Selection.containsNode`
   * + `Selection.getTopNodes` (Phase D.I7b-prep). Ali-faithful: walks
   * the schema children recursively.
   */
  contains(other: unknown): boolean {
    if (other === this) return true;
    if (!other || typeof other !== 'object') return false;
    const oNode = other as Node;
    if (oNode.parent === this) return true;
    // Walk up `other.parent` to see if any ancestor is `this`
    let p: Node | null = oNode.parent;
    while (p) {
      if (p === this) return true;
      p = p.parent;
    }
    return false;
  }
}
