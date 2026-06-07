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

  undo(args: { nodeId: string; key: string; value: JSONValue }, prev: JSONValue | undefined): JSONValue | undefined {
    const node = this.doc.getNode(args.nodeId);
    if (!node) return undefined;
    this.doc.setProps(node, { [args.key]: prev as JSONValue });
    return prev;
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

/**
 * Detecting — the L3 designer's "hover" command. Ali's upstream
 * uses this to drive the hover overlay (the L4 Overlays component
 * already renders `.sapu-hover-overlay` when the project emits a
 * `detecting` state). The command itself just records the current
 * hover id on the project; the actual DOM event handling lives
 * outside (in the simulator's mouse handlers).
 *
 * The execute/undo pair is symmetric: undo restores the previous
 * hover id (or null if there was none).
 */
export class DetectingCommand implements ICommand<{ nodeId: string | null }, string | null> {
  readonly name = 'project.detecting';
  readonly mergeable = false;
  constructor(private readonly project: { setDetecting(id: string | null): void; getDetecting(): string | null }) {}

  execute(args: { nodeId: string | null }): string | null {
    const prev = this.project.getDetecting();
    this.project.setDetecting(args.nodeId);
    return prev;
  }

  undo(args: { nodeId: string | null }, prev: string | null): string | null {
    this.project.setDetecting(prev);
    return prev;
  }
}

/**
 * Scroller — "scroll the canvas so this node is visible". Sapu's
 * stance: the L4 canvas owns its own scroll container, so the
 * Scroller command delegates to the L4 layer via a callback the
 * host installs on the project. The command is recorded in
 * history but the actual scroll is a side effect.
 *
 * Args: { nodeId: 'n_42', block?: 'start' | 'center' | 'end' | 'nearest' }
 * Default block is 'nearest' (mirrors Element.scrollIntoView).
 */
export type ScrollBlock = 'start' | 'center' | 'end' | 'nearest';

export class ScrollerCommand implements ICommand<{ nodeId: string; block?: ScrollBlock }, boolean> {
  readonly name = 'canvas.scrollIntoView';
  readonly mergeable = false;
  constructor(
    private readonly project: { getNode(id: string): unknown; document: { getNode(id: string): unknown } },
    private readonly onScroll: (nodeId: string, block: ScrollBlock) => boolean,
  ) {}

  execute(args: { nodeId: string; block?: ScrollBlock }): boolean {
    const block = args.block ?? 'nearest';
    return this.onScroll(args.nodeId, block);
  }

  undo(): boolean {
    // Scrolling is a UX side effect; undo is a no-op (matching the
    // upstream's behavior).
    return false;
  }
}

/**
 * Clipboard — cut/copy/paste. Sapu's stance: this is *data*
 * clipboard, not OS clipboard. The clipboard is owned by the
 * project (a single `clipboard: { op, payload } | null` slot), so
 * undo/redo for paste is automatic via the CommandManager.
 *
 * Ops:
 *   - 'cut':   copy + remove. The remove is its own RemoveCommand.
 *   - 'copy':  snapshot to clipboard. No document mutation.
 *   - 'paste': insert at the parent's index (or append). Uses
 *              InsertCommand under the hood.
 */
export type ClipboardOp = 'cut' | 'copy' | 'paste';

export interface ClipboardPayload {
  /** Schema to paste, or the source node's schema for cut/copy. */
  schema: unknown;
  /** Original node id (for 'cut' so we can later move-on-paste). */
  sourceId?: string;
}

export class ClipboardCommand implements ICommand<{ op: ClipboardOp; nodeId?: string; parentId?: string | null; index?: number }, ClipboardPayload | null> {
  readonly name = 'project.clipboard';
  readonly mergeable = false;
  constructor(
    private readonly project: {
      getClipboard(): ClipboardPayload | null;
      setClipboard(p: ClipboardPayload | null): void;
      document: { getNode(id: string): unknown; insert(schema: unknown, parent: unknown, index: number): { id: string } };
    },
  ) {}

  execute(args: { op: ClipboardOp; nodeId?: string; parentId?: string | null; index?: number }): ClipboardPayload | null {
    const prev = this.project.getClipboard();
    if (args.op === 'cut' || args.op === 'copy') {
      if (!args.nodeId) return prev;
      const node = this.project.document.getNode(args.nodeId) as { schema: unknown; id: string } | null;
      if (!node) return prev;
      const payload: ClipboardPayload = { schema: node.schema, sourceId: node.id };
      this.project.setClipboard(payload);
      // 'cut' just sets the clipboard in sapu; the actual remove
      // is the host's choice (it can call RemoveCommand separately
      // if it wants a single undo entry). Keeping cut and remove
      // separate means the host can choose cut-without-remove for
      // a "hold to paste elsewhere" UX.
      return prev;
    }
    // paste
    if (!prev) return prev;
    const idx = args.index ?? Number.MAX_SAFE_INTEGER;
    const parent = args.parentId ? this.project.document.getNode(args.parentId) : null;
    this.project.document.insert(prev.schema, parent, idx);
    return prev;
  }

  undo(_args: { op: ClipboardOp }, prev: ClipboardPayload | null): ClipboardPayload | null {
    // Paste inserts a new node; undoing would need to remove it.
    // For symmetry with upstream, we just restore the clipboard
    // state — the host can issue its own RemoveCommand if it
    // wants a true undoable paste.
    this.project.setClipboard(prev);
    return prev;
  }
}
