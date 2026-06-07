/**
 * @monbolc/lowcode-designer — Project
 *
 * The top-level container for a single editing session. Owns:
 *   - a DocumentModel
 *   - a selection (set of node ids)
 *   - a Dragon (drag state)
 *   - a Simulator (preview, wired in L4+)
 *
 * The Project is the integration point that plugins (outline-pane,
 * settings-pane) plug into.
 */

import { Emitter } from '@monbolc/lowcode-utils';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

import { DocumentModel, type DocumentEvents } from './document';
import { Dragon, type DragonEvents } from './dragon';
import { Node } from './node';

export interface ProjectEvents extends Record<string, unknown>, DocumentEvents, DragonEvents {
  /** The selection changed. */
  selectionChanged: { ids: string[] };
  /** A new project was loaded. */
  loaded: Record<string, never>;
}

export class Project {
  readonly events = new Emitter<ProjectEvents>();
  readonly document: DocumentModel;
  readonly dragon: Dragon;
  private _selectedIds: string[] = [];

  constructor(root: IPublicTypeRootSchema) {
    this.document = new DocumentModel(root);
    this.dragon = new Dragon();
    this.wireDocument();
  }

  private wireDocument(): void {
    this.document.events.on('rootChanged', (e) => this.events.emit('rootChanged', e));
    this.document.events.on('nodeAdded', (e) => this.events.emit('nodeAdded', e));
    this.document.events.on('nodeRemoved', (e) => this.events.emit('nodeRemoved', e));
    this.document.events.on('nodePropsChanged', (e) => this.events.emit('nodePropsChanged', e));
    this.document.events.on('nodeMoved', (e) => this.events.emit('nodeMoved', e));
    this.document.events.on('nodeRenamed', (e) => this.events.emit('nodeRenamed', e));
    this.dragon.events.on('start', (e) => this.events.emit('start', e));
    this.dragon.events.on('move', (e) => this.events.emit('move', e));
    this.dragon.events.on('end', (e) => this.events.emit('end', e));
  }

  /** Replace the document with a new root schema. */
  load(root: IPublicTypeRootSchema): void {
    this.document.setRoot(root);
    this._selectedIds = [];
    this.events.emit('loaded', {});
  }

  /* ---------------- Selection ---------------- */

  get selectedIds(): string[] {
    return this._selectedIds.slice();
  }

  select(id: string): void {
    this._selectedIds = [id];
    this.events.emit('selectionChanged', { ids: this._selectedIds });
  }

  selectMany(ids: string[]): void {
    this._selectedIds = ids.slice();
    this.events.emit('selectionChanged', { ids: this._selectedIds });
  }

  addToSelection(id: string): void {
    if (this._selectedIds.includes(id)) return;
    this._selectedIds.push(id);
    this.events.emit('selectionChanged', { ids: this._selectedIds });
  }

  removeFromSelection(id: string): void {
    const i = this._selectedIds.indexOf(id);
    if (i < 0) return;
    this._selectedIds.splice(i, 1);
    this.events.emit('selectionChanged', { ids: this._selectedIds });
  }

  clearSelection(): void {
    if (this._selectedIds.length === 0) return;
    this._selectedIds = [];
    this.events.emit('selectionChanged', { ids: this._selectedIds });
  }

  isSelected(id: string): boolean {
    return this._selectedIds.includes(id);
  }

  /** All currently selected nodes (resolved against the document). */
  getSelectedNodes(): Node[] {
    return this._selectedIds
      .map((id) => this.document.getNode(id))
      .filter((n): n is Node => n !== undefined);
  }
}
