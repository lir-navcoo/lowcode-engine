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

import { Emitter, autorun as _autorun, reaction as _reaction } from '@monbolc/lowcode-utils';
import { ActiveTracker } from './active-tracker';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

import { DocumentModel, type DocumentEvents } from './document';
import { Dragon, type DragonEvents } from './dragon';
import { Node } from './node';
import { ComponentMetaRegistry, type IComponentMetaLite } from './component-meta';

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
  /**
   * Phase E.4: per-Project `ComponentMetaRegistry` (E.3). The slim
   * port instantiates the registry in the constructor; consumers
   * (drag-ghost, BorderDetecting, BorderSelecting, etc.) call
   * `project.getComponentMeta(name)` which delegates to the registry.
   * Ali-faithful: `designer.componentMetasMap` is a Map indexed by
   * component name; the slim port keeps the same shape.
   */
  readonly componentMetas: ComponentMetaRegistry = new ComponentMetaRegistry();
  private _selectedIds: string[] = [];
  private _detectingId: string | null = null;

  /**
   * Ali-faithful `designer.getComponentMeta(name)` shim — delegates to
   * the registry. Returns `undefined` for absent names (slim: no
   * auto-build; callers handle the missing case).
   */
  getComponentMeta(name: string): IComponentMetaLite | undefined {
    return this.componentMetas.getComponentMeta(name);
  }

  // ---------------------------------------------------------------------------
  // Phase C.AB: ali-faithful `autorun` / `reaction` shims
  // ---------------------------------------------------------------------------
  //
  // Ali-faithful port of
  // `alibaba/lowcode-engine/packages/designer/src/designer/designer.ts:650`
  // (`autorun`) and the `reaction` helper. Ali's IDesigner exposes
  // both so plugins can react to MULTIPLE observables at once
  // (re-run when ANY tracked value changes) — not just the
  // discrete-event `project.events` Emitter.
  //
  // Sapu's stance: no MobX, no proxy. We delegate to the Phase A
  // `Observable-lite` helpers (same API shape as MobX's autorun
  // / reaction). Plugins written against ali's
  // `IDesigner.autorun(fn)` / `IDesigner.reaction(track, effect)`
  // pattern work in sapu with zero changes.
  //
  // Why these are at the Project level (not DocumentModel):
  // ali-faithful IDesigner.autorun lets a plugin react to ANY
  // observable in the project — document observables, dragon
  // observables, viewport observables, plugin-defined observables.
  // Hiding the shim behind DocumentModel would scope it to the
  // document's own observables (which is also useful, see
  // `DocumentModel.autorun` below).

  /**
   * Ali-faithful `autorun`. Run `effect()` immediately and every
   * time any `Observable` it read (via `.get()`) changes.
   * Returns a disposer that unsubscribes the re-run.
   *
   * Ali-faithful: same signature as MobX's `autorun(effect)`.
   * Sapu implementation delegates to the Phase A
   * `Observable-lite` helper (no MobX).
   */
  autorun(effect: () => void): () => void {
    return _autorun(effect);
  }

  /**
   * Ali-faithful `reaction(track, effect)`. Run `track()` to read
   * the values to watch; re-run `effect(next, prev)` whenever the
   * tracked values change. The first run does NOT fire `effect`
   * (MobX-aligned: only subsequent transitions fire).
   *
   * Ali-faithful: same signature as MobX's
   * `reaction<T extends readonly unknown[]>(track, effect)`.
   * Sapu implementation delegates to the Phase A
   * `Observable-lite` helper.
   */
  reaction<T extends readonly unknown[]>(track: () => T, effect: (next: T, prev: T) => void): () => void {
    return _reaction(track, effect);
  }
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
