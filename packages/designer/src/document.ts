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
}

export class DocumentModel implements IDocumentModel {
  readonly events = new Emitter<DocumentEvents>();
  private _root: IPublicTypeRootSchema;
  private readonly _nodes = new Map<string, Node>();

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

    const wrapped = new Node(node, parent);
    this.indexSubtree(node, wrapped, safeIndex);
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
    const old = node.schema.componentName;
    if (old === newName) return;
    node.schema.componentName = newName;
    this.events.emit('nodeRenamed', { node, oldName: old, newName });
  }

  move(node: Node, newParent: Node | null, newIndex: number): void {
    const oldParent = node.parent;
    const oldParentSchema = oldParent ? oldParent.schema : this._root;
    const oldIndex = oldParentSchema.children!.indexOf(node.schema);
    if (oldIndex < 0) return;
    oldParentSchema.children!.splice(oldIndex, 1);
    const newParentSchema = newParent ? newParent.schema : this._root;
    const safeIndex = Math.max(0, Math.min(newIndex, newParentSchema.children!.length));
    newParentSchema.children!.splice(safeIndex, 0, node.schema);

    // Re-index the moved subtree (its parent ref changed).
    this.unindexSubtree(node);
    // Update parent reference: easiest is to reconstruct the Node wrapper.
    const rewrapped = new Node(node.schema, newParent);
    this.indexSubtree(node.schema, rewrapped, safeIndex);
    this.events.emit('nodeMoved', { node: rewrapped, oldParent, newParent, oldIndex, newIndex: safeIndex });
  }

  // ---- internals ----

  /**
   * Walk a subtree and register each node (and its children) in
   * `_nodes`. Each node is assigned a synthetic `id` if it doesn't
   * have one, and we wrap it in a `Node` for ergonomic access.
   */
  private indexSubtree(
    schema: IPublicTypeNodeSchema,
    parent: Node | null,
    indexInParent: number,
  ): void {
    const id = schema.key ?? uid('n');
    schema.key = id;
    const wrapped = new Node(schema, parent);
    this._nodes.set(id, wrapped);
    (schema.children ?? []).forEach((child, i) => {
      this.indexSubtree(child, wrapped, i);
    });
  }

  /** Unregister a node and all its descendants. */
  private unindexSubtree(node: Node): void {
    this._nodes.delete(node.id);
    for (const child of node.children) {
      this.unindexSubtree(child);
    }
  }
}
