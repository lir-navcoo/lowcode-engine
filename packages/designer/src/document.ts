/**
 * @monbolc/lowcode-designer — DocumentModel
 *
 * Wraps a root schema with mutation operations. Fires events on every
 * change so the rest of the editor (outline pane, simulator, designer
 * host) can update.
 *
 * This is a *mutable* model: the schema objects are edited in place.
 * Consumers should treat them as read-only and only mutate through
 * the methods below.
 */

import { Emitter, uid } from '@monbolc/lowcode-utils';
import type { IPublicTypeNodeSchema, IPublicTypeRootSchema, JSONValue } from '@monbolc/lowcode-types';

import { Node } from './node';

/**
 * Rect shape returned by `DocumentModel.computeRect` /
 * `getNodeInstancesRect`. Ali-faithful: a `DOMRect` augmented with
 * the elements the rect was computed from + a `computed` flag for
 * multi-instance union rects.
 *
 * Re-exported as `IPublicTypeRect` from `simulator-host.ts`; we
 * mirror the alias here so consumers that already import from
 * `./document` don't need a second import.
 */
export type IPublicTypeRect = import('./simulator-host').IPublicTypeRect;

export interface DocumentEvents extends Record<string, unknown> {
  /** A new root was loaded (replaces the entire document). */
  rootChanged: { root: IPublicTypeRootSchema };
  /** A node was added (in the doc tree). */
  nodeAdded: { node: Node; parent: Node | null; index: number };
  /** A node was removed. */
  nodeRemoved: { node: Node; parent: Node | null };
  /** A node's props were modified. */
  nodePropsChanged: { node: Node; changedKeys: string[] };
  /** A node was moved within the tree. */
  nodeMoved: { node: Node; oldParent: Node | null; newParent: Node | null; oldIndex: number; newIndex: number };
  /** A node's componentName was changed. */
  nodeRenamed: { node: Node; oldName: string; newName: string };
}

/** Minimal contract a `DocumentModel` host must satisfy to answer
 *  `computeRect` / `getNodeInstancesRect` queries. Ali-faithful:
 *  the `BuiltinSimulatorHost` is the only known implementation,
 *  but tests can pass a mock to drive the rect math without a
 *  real simulator. */
export interface IDocumentModelHost {
  getComponentInstances(node: Node): unknown[] | null;
  computeComponentInstanceRect(instance: unknown, selector?: string): IPublicTypeRect | null;
}

export interface IDocumentModel {
  readonly events: Emitter<DocumentEvents>;
  /** Root schema. Mutating it directly is discouraged; use the methods below. */
  readonly root: IPublicTypeRootSchema;
  /** All known nodes keyed by their stable id. */
  readonly nodes: Map<string, Node>;

  /** Replace the entire document with a new root. */
  setRoot(root: IPublicTypeRootSchema): void;

  /** Wrap a node in the Node class. Returns undefined if not in this doc. */
  getNode(id: string): Node | undefined;

  /** Insert a new node as a child of `parent` (or root) at `index`. */
  insert(node: IPublicTypeNodeSchema, parent: Node | null, index: number): Node;
  /** Remove a node from the document. */
  remove(node: Node): void;
  /** Update a node's props (shallow). */
  setProps(node: Node, patch: Record<string, JSONValue>): void;
  /** Rename a node's componentName. */
  rename(node: Node, newName: string): void;
  /** Move a node to a new parent / index. */
  move(node: Node, newParent: Node | null, newIndex: number): void;

  // ---- Phase C ali-mirror: rect math ----
  /** Wire the host that answers rect queries. The Project wires
   *  its `BuiltinSimulatorHost` in at construction; tests can
   *  wire a mock. */
  setHost(host: IDocumentModelHost | null): void;
  /** Compute the live rect for a node. Ali-faithful: returns
   *  `null` when no instances are registered (the node isn't
   *  mounted on the canvas). */
  computeRect(node: Node, selector?: string): IPublicTypeRect | null;
  /** Ali-faithful alias for `computeRect(node)`. */
  getNodeInstancesRect(node: Node, selector?: string): IPublicTypeRect | null;
}

export class DocumentModel implements IDocumentModel {
  readonly events = new Emitter<DocumentEvents>();
  private _root: IPublicTypeRootSchema;
  private readonly _nodes = new Map<string, Node>();
  /** Phase C: host that answers rect queries. Set via `setHost`
   *  from the Project (so a `BuiltinSimulatorHost` is the canonical
   *  implementation). Tests can pass a mock. */
  private _host: IDocumentModelHost | null = null;

  constructor(root: IPublicTypeRootSchema) {
    this._root = root;
    this.indexSubtree(root, null, 0);
  }

  get root(): IPublicTypeRootSchema {
    return this._root;
  }

  get nodes(): Map<string, Node> {
    return this._nodes;
  }

  setRoot(root: IPublicTypeRootSchema): void {
    this._nodes.clear();
    this._root = root;
    this.indexSubtree(root, null, 0);
    this.events.emit('rootChanged', { root });
  }

  getNode(id: string): Node | undefined {
    return this._nodes.get(id);
  }

  insert(node: IPublicTypeNodeSchema, parent: Node | null, index: number): Node {
    if (!node.children) node.children = [];
    const parentSchema = parent ? parent.schema : this._root;
    const safeIndex = Math.max(0, Math.min(index, parentSchema.children!.length));
    parentSchema.children!.splice(safeIndex, 0, node);

    // Use registerNode — the single source of truth for creating a Node
    // wrapper and storing it in _nodes. This guarantees the wrapper
    // returned to the caller is the same one stored in _nodes (so
    // `getNode(id)` returns a wrapper with the correct parent ref).
    const wrapped = this.registerNode(node, parent);
    this.events.emit('nodeAdded', { node: wrapped, parent, index: safeIndex });
    return wrapped;
  }

  remove(node: Node): void {
    const parent = node.parent;
    const parentSchema = parent ? parent.schema : this._root;
    const idx = parentSchema.children!.indexOf(node.schema);
    if (idx < 0) return;
    parentSchema.children!.splice(idx, 1);
    this.unindexSubtree(node);
    this.events.emit('nodeRemoved', { node, parent });
  }

  setProps(node: Node, patch: Record<string, JSONValue>): void {
    const before = node.schema.props ?? {};
    const after = { ...before, ...patch };
    const changed = Object.keys(patch).filter((k) => before[k] !== patch[k]);
    if (changed.length === 0) return;
    node.schema.props = after;
    this.events.emit('nodePropsChanged', { node, changedKeys: changed });
  }

  rename(node: Node, newName: string): void {
    // The root componentName is the render entry (e.g. "Page" maps
    // to the host's <Page> component). Renaming it would change
    // the document's *root type* — the simulator would no longer
    // have a matching component in the registry and would fall
    // back to a placeholder. Refuse the mutation here so the
    // safety net is in place even if a host forgets to hide the
    // Rename UI for the root selection.
    if (node.parent === null) return;
    const old = node.schema.componentName;
    if (old === newName) return;
    node.schema.componentName = newName;
    this.events.emit('nodeRenamed', { node, oldName: old, newName });
  }

  move(node: Node, newParent: Node | null, newIndex: number): void {
    const oldParent = node.parent;
    const oldParentSchema = oldParent ? oldParent.schema : this._root;
    if (!oldParentSchema.children) oldParentSchema.children = [];
    const oldIndex = oldParentSchema.children!.indexOf(node.schema);
    if (oldIndex < 0) return;
    oldParentSchema.children!.splice(oldIndex, 1);
    const newParentSchema = newParent ? newParent.schema : this._root;
    if (!newParentSchema.children) newParentSchema.children = [];
    const safeIndex = Math.max(0, Math.min(newIndex, newParentSchema.children!.length));
    newParentSchema.children!.splice(safeIndex, 0, node.schema);

    // Re-index the moved subtree (its parent ref changed).
    this.unindexSubtree(node);
    // Build a fresh wrapper with the correct parent. Pass `newParent`
    // directly to indexSubtree so the stored wrapper's parent ref
    // is the actual new parent (B), not an outer wrapper of B.
    this.indexSubtree(node.schema, newParent, safeIndex);
    this.events.emit('nodeMoved', { node, oldParent, newParent, oldIndex, newIndex: safeIndex });
  }

  // ---- internals ----

  /**
   * Walk a subtree and register each node (and its children) in
   * `_nodes`. Each node is assigned a synthetic `id` if it doesn't
   * have one, and we wrap it in a `Node` for ergonomic access.
   * Returns the wrapper for `schema` so callers can use it.
   */
  private indexSubtree(
    schema: IPublicTypeNodeSchema,
    parent: Node | null,
    _indexInParent: number,
  ): Node {
    const id = schema.key ?? uid('n');
    schema.key = id;
    const wrapped = new Node(schema, parent);
    this._nodes.set(id, wrapped);
    (schema.children ?? []).forEach((child, i) => {
      this.indexSubtree(child, wrapped, i);
    });
    return wrapped;
  }

  /**
   * Public entry: index a single node and return its wrapper. Use
   * this from `insert` / `move` to ensure the wrapper stored in
   * `_nodes` is the same one returned to the caller.
   */
  private registerNode(schema: IPublicTypeNodeSchema, parent: Node | null): Node {
    return this.indexSubtree(schema, parent, 0);
  }

  /** Unregister a node and all its descendants. */
  private unindexSubtree(node: Node): void {
    this._nodes.delete(node.id);
    for (const child of node.children) {
      this.unindexSubtree(child);
    }
  }

  // ---- Phase C ali-mirror: rect math ----

  /** Wire the host (Project does this at construction). Pass
   *  `null` to clear. */
  setHost(host: IDocumentModelHost | null): void {
    this._host = host;
  }

  /**
   * Ali-faithful: compute the live rect for a node. Looks up
   * the node's first registered component instance, then
   * delegates to the host's `computeComponentInstanceRect`.
   * Returns `null` when no host is wired OR the node has no
   * registered instances.
   */
  computeRect(node: Node, selector?: string): IPublicTypeRect | null {
    if (!this._host) return null;
    const instances = this._host.getComponentInstances(node);
    if (!instances || instances.length === 0) return null;
    return this._host.computeComponentInstanceRect(instances[0]!, selector);
  }

  /** Ali-faithful alias for `computeRect(node, selector?)`. */
  getNodeInstancesRect(node: Node, selector?: string): IPublicTypeRect | null {
    return this.computeRect(node, selector);
  }
}
