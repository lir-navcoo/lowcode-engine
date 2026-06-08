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
import { ActiveTracker } from './active-tracker';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

import { DocumentModel, type DocumentEvents } from './document';
import { Dragon, type DragonEvents } from './dragon';
import { Node } from './node';

export interface ProjectEvents extends Record<string, unknown>, DocumentEvents, DragonEvents {
  /** The selection changed. */
  selectionChanged: { ids: string[] };
  /** The hover-detected node changed (F — Detecting command). */
  detectingChanged: { id: string | null };
  /** The internal data clipboard changed (F — Clipboard command). */
  clipboardChanged: Record<string, never>;
  /** A new project was loaded. */
  loaded: Record<string, never>;
  /** The active node (single-focus concept, ali-faithful) changed. */
  activeNodeChanged: { id: string | null };
}

export class Project {
  readonly events = new Emitter<ProjectEvents>();
  readonly document: DocumentModel;
  readonly dragon: Dragon;
  readonly activeTracker = new ActiveTracker();
  private _selectedIds: string[] = [];
  private _detectingId: string | null = null;
  private _clipboard: import('./commands').ClipboardPayload | null = null;

  constructor(root: IPublicTypeRootSchema) {
    this.document = new DocumentModel(root);
    this.dragon = new Dragon();
    this.wireDocument();
    this.wireActiveTracker();
  }

  /**
   * The id of the currently active node, or null. Ali-faithful
   * short-hand for `activeTracker.activeNodeId`. Plugins that
   * just want "the one node the next command will act on" can
   * read this without reaching into `activeTracker`.
   */
  get activeNodeId(): string | null {
    return this.activeTracker.activeNodeId;
  }

  /**
   * Set the active node. Pass null to clear. Ali-faithful
   * short-hand for `activeTracker.set(id)`. Validates the id
   * exists in the document so plugins can pass a stale id
   * without crashing.
   */
  setActiveNode(id: string | null): void {
    this.activeTracker.set(id, (candidate) => !!this.document.getNode(candidate));
  }

  private wireActiveTracker(): void {
    this.activeTracker.events.on('activeNodeChanged', ({ id }) => {
      this.events.emit('activeNodeChanged', { id });
    });
  }

  private wireDocument(): void {
    this.document.events.on('rootChanged', (e) => this.events.emit('rootChanged', e));
    this.document.events.on('nodeAdded', (e) => this.events.emit('nodeAdded', e));
    this.document.events.on('nodeRemoved', (e) => this.events.emit('nodeRemoved', e));
    this.document.events.on('nodePropsChanged', (e) => this.events.emit('nodePropsChanged', e));
    this.document.events.on('nodeMoved', (e) => this.events.emit('nodeMoved', e));
    this.document.events.on('nodeRenamed', (e) => this.events.emit('nodeRenamed', e));
    this.dragon.events.on('start', (e) => this.events.emit('start', e));
    this.dragon.events.on('startBoost', (e) => this.events.emit('startBoost', e));
    this.dragon.events.on('move', (e) => this.events.emit('move', e));
    this.dragon.events.on('dropBoost', (e) => this.events.emit('dropBoost', e));
    this.dragon.events.on('cancelBoost', (e) => this.events.emit('cancelBoost', e));
  }

  /** Replace the document with a new root schema. */
  load(root: IPublicTypeRootSchema): void {
    this.document.setRoot(root);
    this._selectedIds = [];
    this._detectingId = null;
    this._clipboard = null;
    // P23: the active node is document-scoped — clear it on
    // load. Don't re-emit the event (the activeTracker would
    // emit it; we let it flow through normally).
    this.activeTracker.set(null);
    this.events.emit('loaded', {});
  }

  /* ---------------- Detecting (hover) ---------------- */

  getDetecting(): string | null {
    return this._detectingId;
  }

  setDetecting(id: string | null): void {
    if (this._detectingId === id) return;
    this._detectingId = id;
    this.events.emit('detectingChanged', { id });
  }

  /* ---------------- Clipboard ---------------- */

  getClipboard(): import('./commands').ClipboardPayload | null {
    return this._clipboard;
  }

  setClipboard(p: import('./commands').ClipboardPayload | null): void {
    this._clipboard = p;
    this.events.emit('clipboardChanged', {});
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
