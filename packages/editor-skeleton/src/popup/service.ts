/**
 * @monbolc/lowcode-editor-skeleton — SapuPopupService
 *
 * A tiny imperative registry for popovers / dropdowns anchored to
 * arbitrary DOM elements. Sapu's stance:
 *
 * - One singleton (`popupService`) is exported so plugins and
 * host code can call `popupService.open(...)` without owning
 * any extra state. Upstream v1.3.2 (`alibaba v1.3.2`) uses an
 * `IPublicModelPopupService` class for the same purpose.
 * - `open` returns a string id; `close(id)` removes that specific
 * descriptor. `closeAll()` is a bulk reset. `list()` returns a
 * snapshot of the current descriptors for inspection (tests use
 * it to assert "the popup we opened is still listed").
 *
 * Each descriptor records:
 * - `id` — the same string returned by `open`
 * - `anchor` — either an HTMLElement or a RefObject wrapping one
 * - `content` — the React node the renderer should mount inside
 * the positioned popup
 * - `placement` — one of `'top' | 'right' | 'bottom' | 'left'`,
 * default `'bottom'`
 */

import type { RefObject, ReactNode } from 'react';

/**
 * The placement side of the popup relative to its anchor.
 * Mirrors the `placement` prop on BaseUI `Popover.Positioner`.
 */
export type PopupPlacement = 'top' | 'right' | 'bottom' | 'left';

/**
 * A live popup descriptor. The renderer (`<SapuPopup>`) reads
 * `list()` to materialize each descriptor into a BaseUI Popover.
 */
export interface PopupDescriptor {
 id: string;
 anchor: HTMLElement | RefObject<HTMLElement>;
 content: ReactNode;
 placement: PopupPlacement;
}

/**
 * Options for `open`. `placement` is optional and defaults to
 * `'bottom'`. `id` is optional — pass one to make `close(id)`
 * stable across calls; otherwise a monotonic id is generated.
 */
export interface PopupOpenOptions {
 placement?: PopupPlacement;
 /** Optional explicit id. When omitted, a numeric id is generated. */
 id?: string;
}

let _idCounter =0;

function nextId(): string {
 return `popup-${++_idCounter}`;
}

/**
 * The popup service class. Hosts can construct their own instance
 * for isolation (e.g. multi-window editors) but the canonical
 * path is to import the exported `popupService` singleton below.
 */
export class SapuPopupService {
 private readonly store = new Map<string, PopupDescriptor>();

 /**
 * Open a new popup. Returns the descriptor id; pass that id to
 * `close(id)` to remove it. Re-opening with the same explicit
 * id replaces the previous descriptor.
 */
 open(
 anchor: HTMLElement | RefObject<HTMLElement>,
 content: ReactNode,
 options?: PopupOpenOptions,
 ): string {
 const id = options?.id ?? nextId();
 const placement: PopupPlacement = options?.placement ?? 'bottom';
 const desc: PopupDescriptor = { id, anchor, content, placement };
 this.store.set(id, desc);
 this.notifyChange();
 return id;
 }

 /**
 * Close a single popup by id. No-op if the id is unknown.
 */
 close(id: string): void {
 if (!this.store.has(id)) return;
 this.store.delete(id);
 this.notifyChange();
 }

 /**
 * Close every popup. Used as a "reset" path during teardown or
 * when the editor swaps its project.
 */
 closeAll(): void {
 if (this.store.size ===0) return;
 this.store.clear();
 this.notifyChange();
 }

 /**
 * Read-only snapshot of the current descriptors. Order is the
 * insertion order (Map preserves it).
 */
 list(): PopupDescriptor[] {
 return Array.from(this.store.values());
 }

 /**
 * Read-only size. Cheap O(1) accessor for tests that need a count
 * without allocating an array.
 */
 get size(): number {
 return this.store.size;
 }

 /**
 * Subscribe to add / remove events. Returns a disposer.
 * Internal — `<SapuPopup>` calls this so its render reflects the
 * latest set.
 */
 subscribe(listener: () => void): () => void {
 this.listeners.add(listener);
 return () => {
 this.listeners.delete(listener);
 };
 }

 private readonly listeners = new Set<() => void>();
 private notifyChange(): void {
 for (const fn of this.listeners) fn();
 }
}

/**
 * The canonical singleton. Hosts that want isolation can `new
 * SapuPopupService()` themselves; the default path is just
 * `import { popupService } from '@monbolc/lowcode-editor-skeleton'`.
 */
export const popupService = new SapuPopupService();
