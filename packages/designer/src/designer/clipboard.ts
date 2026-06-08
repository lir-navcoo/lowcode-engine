/**
 * @monbolc/lowcode-designer — Clipboard (Phase B ali-mirror)
 *
 * Ali-faithful port of
 * `alibaba/lowcode-engine/packages/designer/src/designer/clipboard.ts`.
 * The class wraps the same off-screen-textarea trick ali uses
 * to bridge between `keydown` (`Ctrl+C` / `Ctrl+V`) and the
 * browser's `ClipboardEvent`. Sapu has a slim equivalent
 * (`ClipboardCommand` in `commands.ts`) that operates at the
 * document level; this class is the LOWER-level DOM helper
 * ali uses for cross-iframe + cross-document copy/paste, and
 * it stays useful for plugins that need to drive the native
 * clipboard from a non-document context (e.g. inside the
 * editor-skeleton's settings panel).
 *
 * Ali uses `document.execCommand('copy')` which is deprecated
 * but still the only cross-browser way to write to the system
 * clipboard from JS without a Permissions-Policy grant. We
 * keep the deprecated API (Phase B scope: ali-faithful port;
 * if a plugin reports a broken copy, add a `navigator.clipboard.writeText`
 * fallback gated on `typeof navigator !== 'undefined' && navigator.clipboard`).
 *
 * `ClipboardCommand` in `commands.ts` (KEEP) is the high-level
 * facade for cut/copy/paste of nodes; this class is the
 * low-level DOM-bridge underneath. The two coexist; a plugin
 * uses whichever surface matches its need.
 */

import { Emitter, type EventMap } from '@monbolc/lowcode-utils';

/**
 * Ali-faithful shape. Plain data; no MobX.
 *
 * Renamed from `ClipboardPayload` to `DomClipboardPayload` to
 * avoid the name collision with `commands.ts`'s schema-level
 * `ClipboardPayload`. The two are unrelated: this one is the
 * DOM-bridge payload the hidden-textarea trick reads/writes;
 * `commands.ts`'s is the data payload the project's
 * `ClipboardCommand` carries for undo/redo. Ali's port has
 * the same name in both places because their `commands.ts`
 * doesn't ship a schema-level clipboard command — sapu does.
 */
export interface DomClipboardPayload {
  componentsTree?: unknown[];
  componentName?: string;
  [key: string]: unknown;
}

export interface ClipboardEvents extends EventMap {
  /** Fired after `setData` writes to the textarea. */
  set: { data: DomClipboardPayload | string };
  /** Fired when `waitPasteData` resolves with the pasted text. */
  paste: { data: DomClipboardPayload; event: ClipboardEvent };
}

/** Ali-faithful: `getDataFromPasteEvent` lives at module scope
 *  in ali; we keep it here. Parses the JSON payload from the
 *  hidden textarea and normalizes to `componentsTree` array. */
function getDataFromPasteEvent(event: ClipboardEvent): DomClipboardPayload {
  const { clipboardData } = event;
  if (!clipboardData) return {};
  try {
    const data = JSON.parse(clipboardData.getData('text/plain'));
    if (!data) return {};
    if (data.componentsTree) return data as DomClipboardPayload;
    if (data.componentName) {
      return { componentsTree: [data] };
    }
    return data as DomClipboardPayload;
  } catch {
    return {};
  }
}

export class Clipboard {
  readonly events = new Emitter<ClipboardEvents>();
  private readonly _copyPasters: HTMLTextAreaElement[] = [];
  private _waitFn: ((data: DomClipboardPayload, e: ClipboardEvent) => void) | null = null;

  constructor(doc: Document = document) {
    this.injectCopyPaster(doc);
  }

  /** Ali-faithful: `injectCopyPaster(document)`. Inserts a hidden
   *  `<textarea>` into the body and wires a `paste` listener.
   *  Returns a disposer. */
  injectCopyPaster(doc: Document): () => void {
    if (this._copyPasters.find((x) => x.ownerDocument === doc)) {
      return () => undefined;
    }
    const copyPaster = doc.createElement('textarea');
    copyPaster.style.cssText = 'position: absolute; left: -9999px; top: -100px';
    if (doc.body) {
      doc.body.appendChild(copyPaster);
    } else {
      doc.addEventListener('DOMContentLoaded', () => {
        if (doc.body) doc.body.appendChild(copyPaster);
      });
    }
    const dispose = this._initCopyPaster(copyPaster);
    return () => {
      dispose();
      if (copyPaster.parentNode) copyPaster.parentNode.removeChild(copyPaster);
    };
  }

  /** Ali-faithful: `initCopyPaster(el)`. Wires the paste listener. */
  private _initCopyPaster(el: HTMLTextAreaElement): () => void {
    this._copyPasters.push(el);
    const onPaste = (e: ClipboardEvent): void => {
      if (this._waitFn) {
        const data = getDataFromPasteEvent(e);
        this._waitFn(data, e);
        this.events.emit('paste', { data, event: e });
        this._waitFn = null;
      }
      el.blur();
    };
    el.addEventListener('paste', onPaste, false);
    return () => {
      el.removeEventListener('paste', onPaste, false);
      const i = this._copyPasters.indexOf(el);
      if (i > -1) this._copyPasters.splice(i, 1);
    };
  }

  /** Ali-faithful: `setData(data)`. Selects the textarea +
   *  `execCommand('copy')`. Returns whether the copy succeeded. */
  setData(data: DomClipboardPayload | string): boolean {
    const copyPaster = this._copyPasters.find((x) => x.ownerDocument);
    if (!copyPaster) return false;
    copyPaster.value = typeof data === 'string' ? data : JSON.stringify(data);
    copyPaster.select();
    const ok = copyPaster.ownerDocument?.execCommand('copy') ?? false;
    copyPaster.blur();
    if (ok) this.events.emit('set', { data });
    return ok;
  }

  /** Ali-faithful: `waitPasteData(keyboardEvent, cb)`. Wires
   *  a one-shot `paste` callback on the matching copyPaster. */
  waitPasteData(keyboardEvent: KeyboardEvent, cb: (data: DomClipboardPayload, e: ClipboardEvent) => void): void {
    const win = keyboardEvent.view;
    if (!win) return;
    const copyPaster = this._copyPasters.find((cp) => cp.ownerDocument === win.document);
    if (copyPaster) {
      copyPaster.select();
      this._waitFn = cb;
    }
  }
}

/** Ali-faithful default singleton — usable directly, or
 *  consumers can `new Clipboard(otherDocument)` for an iframe
 *  document. */
export const clipboard = new Clipboard();
