/**
 * @monbolc/lowcode-plugin-outline-pane — OutlinePane public API
 *
 * State holder for the outline tree. The UI component (OutlineView)
 * is a pure consumer of this state; mutations go through the methods
 * below so that other parts of the editor (selection, drag) can
 * drive the pane.
 */

import { Emitter } from '@monbolc/lowcode-utils';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

import { schemaToTreeNodes, findNode } from './tree';
import type { ITreeNode } from './tree';

export interface OutlinePaneEvents extends Record<string, unknown> {
  /** A new schema was set. */
  schemaChanged: { rootId: string };
  /** A node was selected. */
  selectionChanged: { id: string; ids: string[] };
  /** A node was expanded/collapsed. */
  expansionChanged: { id: string; expanded: boolean };
  /** A node was renamed (display title changed). */
  renamed: { id: string; title: string };
}

export interface IOutlinePane {
  readonly events: Emitter<OutlinePaneEvents>;
  /** Current flat tree, or [] if no schema set. */
  readonly nodes: ITreeNode[];
  /** Currently selected node ids (single-select or multi-select). */
  readonly selectedIds: string[];

  /** Replace the entire schema. Recomputes the tree. */
  setSchema(schema: IPublicTypeNodeSchema): void;

  /** Clear the schema (pane becomes empty). */
  clear(): void;

  /** Select one or more nodes. Pass [] to clear selection. */
  select(ids: string[]): void;
  /** Add a node to the current selection. */
  addToSelection(id: string): void;
  /** Remove a node from the current selection. */
  removeFromSelection(id: string): void;
  /** True if id is currently selected. */
  isSelected(id: string): boolean;

  /** Expand a node. */
  expand(id: string): void;
  /** Collapse a node. */
  collapse(id: string): void;
  /** Expand every node. */
  expandAll(): void;
  /** Collapse every node. */
  collapseAll(): void;
  /** Toggle a node's expansion. */
  toggle(id: string): void;
  /** True if the node is expanded. */
  isExpanded(id: string): boolean;

  /** Rename a node's display title. */
  rename(id: string, title: string): void;

  /** Look up a node by id. */
  getNode(id: string): ITreeNode | undefined;
}

export class OutlinePane implements IOutlinePane {
  readonly events = new Emitter<OutlinePaneEvents>();
  private _nodes: ITreeNode[] = [];
  private _selected: string[] = [];
  private _rootId: string = 'root';

  get nodes(): ITreeNode[] {
    return this._nodes;
  }

  get selectedIds(): string[] {
    return this._selected;
  }

  setSchema(schema: IPublicTypeNodeSchema): void {
    this._rootId = `root_${Math.random().toString(36).slice(2, 8)}`;
    this._nodes = schemaToTreeNodes(schema, this._rootId);
    this._selected = [];
    this.events.emit('schemaChanged', { rootId: this._rootId });
  }

  clear(): void {
    this._nodes = [];
    this._selected = [];
  }

  select(ids: string[]): void {
    this._selected = ids.slice();
    const id = ids[0] ?? '';
    this.events.emit('selectionChanged', { id, ids: this._selected });
  }

  addToSelection(id: string): void {
    if (!this._selected.includes(id)) {
      this._selected.push(id);
      this.events.emit('selectionChanged', { id, ids: this._selected });
    }
  }

  removeFromSelection(id: string): void {
    const i = this._selected.indexOf(id);
    if (i >= 0) {
      this._selected.splice(i, 1);
      this.events.emit('selectionChanged', { id: '', ids: this._selected });
    }
  }

  isSelected(id: string): boolean {
    return this._selected.includes(id);
  }

  expand(id: string): void {
    this.setExpanded(id, true);
  }

  collapse(id: string): void {
    this.setExpanded(id, false);
  }

  private setExpanded(id: string, expanded: boolean): void {
    const node = findNode(this._nodes, id);
    if (!node) return;
    node.expanded = expanded;
    this.events.emit('expansionChanged', { id, expanded });
  }

  expandAll(): void {
    for (const n of this._nodes) n.expanded = true;
    this.events.emit('expansionChanged', { id: '', expanded: true });
  }

  collapseAll(): void {
    for (const n of this._nodes) n.expanded = false;
    this.events.emit('expansionChanged', { id: '', expanded: false });
  }

  toggle(id: string): void {
    const node = findNode(this._nodes, id);
    if (!node) return;
    this.setExpanded(id, !node.expanded);
  }

  isExpanded(id: string): boolean {
    return findNode(this._nodes, id)?.expanded ?? false;
  }

  rename(id: string, title: string): void {
    const node = findNode(this._nodes, id);
    if (!node) return;
    node.title = title;
    this.events.emit('renamed', { id, title });
  }

  getNode(id: string): ITreeNode | undefined {
    return findNode(this._nodes, id);
  }
}
