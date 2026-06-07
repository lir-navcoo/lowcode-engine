/**
 * @monbolc/lowcode-designer — Document commands
 *
 * Each DocumentModel mutation (insert/remove/move/setProps/rename) is
 * wrapped as an ICommand so the editor gets undo/redo for free via
 * the CommandManager from @monbolc/lowcode-plugin-command.
 */

import type { ICommand } from '@monbolc/lowcode-plugin-command';
import type { JSONValue } from '@monbolc/lowcode-types';

import type { DocumentModel } from './document';
import type { Node } from './node';

/**
 * Insert a node at parent + index.
 * Undo: remove the same node.
 */
export class InsertCommand implements ICommand<{ schema: unknown; parentId: string | null; index: number }, unknown> {
  readonly name = 'document.insert';
  readonly mergeable = false;
  constructor(private readonly doc: DocumentModel) {}

  execute(args: { schema: unknown; parentId: string | null; index: number }): unknown {
    const parent = args.parentId ? this.doc.getNode(args.parentId) ?? null : null;
    const inserted = this.doc.insert(args.schema as never, parent, args.index);
    return inserted.id;
  }

  undo(args: { schema: unknown; parentId: string | null; index: number }, _return: unknown): void {
    const id = _return as string;
    const node = this.doc.getNode(id);
    if (node) this.doc.remove(node);
  }
}

/**
 * Remove a node.
 * Undo: re-insert at the recorded position.
 */
export class RemoveCommand implements ICommand<{ nodeId: string }, unknown> {
  readonly name = 'document.remove';
  readonly mergeable = false;
  constructor(private readonly doc: DocumentModel) {}

  // Capture the snapshot at construction time (before execute) so undo
  // has enough info to re-insert.
  private snapshot: { parentId: string | null; index: number; schema: unknown } | null = null;

  execute(args: { nodeId: string }): unknown {
    const node = this.doc.getNode(args.nodeId);
    if (!node) return null;
    this.snapshot = this.capture(node);
    this.doc.remove(node);
    return null;
  }

  undo(_args: { nodeId: string }, _return: unknown): void {
    if (!this.snapshot) return;
    const parent = this.snapshot.parentId ? this.doc.getNode(this.snapshot.parentId) ?? null : null;
    this.doc.insert(this.snapshot.schema as never, parent, this.snapshot.index);
  }

  private capture(node: Node): { parentId: string | null; index: number; schema: unknown } {
    const parentSchema = node.parent ? node.parent.schema : this.doc.root;
    return {
      parentId: node.parent?.id ?? null,
      index: parentSchema.children!.indexOf(node.schema),
      // Deep-clone via JSON to avoid mutation aliasing.
      schema: JSON.parse(JSON.stringify(node.schema)),
    };
  }
}

/**
 * Move a node to a new parent/index.
 * Undo: move it back.
 */
export class MoveCommand implements ICommand<{ nodeId: string; newParentId: string | null; newIndex: number }, unknown> {
  readonly name = 'document.move';
  readonly mergeable = false;
  constructor(private readonly doc: DocumentModel) {}

  // Snapshot the original position so we can restore.
  private from: { parentId: string | null; index: number } | null = null;

  execute(args: { nodeId: string; newParentId: string | null; newIndex: number }): unknown {
    const node = this.doc.getNode(args.nodeId);
    if (!node) return null;
    const parentSchema = node.parent ? node.parent.schema : this.doc.root;
    this.from = { parentId: node.parent?.id ?? null, index: parentSchema.children!.indexOf(node.schema) };
    const newParent = args.newParentId ? this.doc.getNode(args.newParentId) ?? null : null;
    this.doc.move(node, newParent, args.newIndex);
    return null;
  }

  undo(_args: { nodeId: string; newParentId: string | null; newIndex: number }, _return: unknown): void {
    if (!this.from) return;
    const node = this.doc.getNode(_args.nodeId);
    if (!node) return;
    const origParent = this.from.parentId ? this.doc.getNode(this.from.parentId) ?? null : null;
    this.doc.move(node, origParent, this.from.index);
  }
}

/**
 * Set a single prop on a node.
 * Undo: restore the previous value.
 *
 * `mergeable: true` — consecutive edits within `mergeWindowMs` of
 * the same prop on the same node collapse into one history entry
 * (useful for slider-drag, color-picker drag, etc.).
 *
 * Note: when merged, the undo restores the value that existed
 * BEFORE the first edit in the merge window. This is implemented
 * by returning the previous value from execute() — the CommandManager
 * stores it as `returnValue` on the (merged) history entry.
 */
export class SetPropCommand implements ICommand<{ nodeId: string; key: string; value: JSONValue }, JSONValue | undefined> {
  readonly name = 'document.setProp';
  readonly mergeable = true;
  readonly mergeWindowMs = 300;
  constructor(private readonly doc: DocumentModel) {}

  execute(args: { nodeId: string; key: string; value: JSONValue }): JSONValue | undefined {
    const node = this.doc.getNode(args.nodeId);
    if (!node) return undefined;
    const prev = node.props[args.key];
    this.doc.setProps(node, { [args.key]: args.value });
    return prev;
  }

  undo(args: { nodeId: string; key: string; value: JSONValue }, prev: JSONValue | undefined): void {
    const node = this.doc.getNode(args.nodeId);
    if (!node) return;
    this.doc.setProps(node, { [args.key]: prev as JSONValue });
  }
}

/**
 * Rename a node's componentName.
 * Undo: restore the previous name.
 */
export class RenameCommand implements ICommand<{ nodeId: string; newName: string }, unknown> {
  readonly name = 'document.rename';
  readonly mergeable = false;
  constructor(private readonly doc: DocumentModel) {}

  private old: string | null = null;
  execute(args: { nodeId: string; newName: string }): unknown {
    const node = this.doc.getNode(args.nodeId);
    if (!node) return null;
    this.old = node.componentName;
    this.doc.rename(node, args.newName);
    return null;
  }
  undo(args: { nodeId: string; newName: string }, _return: unknown): void {
    if (this.old == null) return;
    const node = this.doc.getNode(args.nodeId);
    if (!node) return;
    this.doc.rename(node, this.old);
  }
}
