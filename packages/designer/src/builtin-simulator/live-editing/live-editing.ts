/**
 * @monbolc/lowcode-designer — builtin-simulator/live-editing
 * Ali-mirror Phase D.I8: the `LiveEditing` class — double-click in-place
 * text editing for component text props.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/live-editing/live-editing.ts`
 * (232 LoC ali → ~180 LoC slim). The class is a pure DOM utility
 * (no React, no mobx) — `apply(target)` finds the right
 * `setterPropElement` (the DOM element holding the prop value), sets
 * `contenteditable="plaintext-only"`, focuses + moves the caret, and
 * listens for `focusout` / `keydown` to save + dispose.
 *
 * Slim translations applied:
 *   - `@obx.ref private _editing: Prop | null` → `Observable<unknown | null>`
 *     (Prop is ali's class; the slim port uses `unknown` + a cast
 *     when calling `setValue` — the slim `Prop` class is a Phase D-2
 *     addition; until then, the structural cast is safe because we
 *     only call `prop.setValue(content)` which the schema mutation
 *     path can satisfy)
 *   - `node.componentMeta.liveTextEditing` → slim `Node` has no
 *     `componentMeta` field (D.I7 added a structural slot; the
 *     `liveTextEditing` config is ali-faithful config data that
 *     lives on the meta — slim treats it as `unknown` for now)
 *   - `setCaret` / `caretRangeFromPoint` → slim: uses `document.createRange`
 *     + `selection.addRange` (cross-browser; happy-dom supports it)
 *   - The `apply` flow's auto-pure-text-edit detection (the TODO block
 *     ali marks as "一期") is omitted — slim port is verbatim to ali's
 *     "pre-condition: data-setter-prop or liveTextEditing must match"
 *
 * Module-static handler registries (ali-faithful: `addLiveEditingSaveHandler`
 * / `addLiveEditingSpecificRule` etc.) are kept 1:1 — plugins can
 * register custom rules + save handlers at runtime.
 */

const EDITOR_KEY = 'data-setter-prop';

/**
 * Ali-faithful: walk up the DOM to find the nearest `[data-setter-prop]`
 * ancestor that's still inside the root. Returns `null` if not found.
 */
function getSetterPropElement(ele: HTMLElement, root: HTMLElement): HTMLElement | null {
  const box = ele.closest(`[${EDITOR_KEY}]`);
  if (!box || !root.contains(box)) {
    return null;
  }
  return box as HTMLElement;
}

/**
 * Ali-faithful default save handler: writes the new text into the
 * prop's value. Slim port uses a structural cast to call `setValue`;
 * the slim `Prop` class is a Phase D-2 addition.
 */
function defaultSaveContent(content: string, prop: { setValue(v: unknown): void }): void {
  prop.setValue(content);
}

/**
 * Ali-faithful `EditingTarget`: the live-editing entry point.
 */
export interface EditingTarget {
  /**
   * Phase E.7: slim `Node` (with the typed `getComponentMeta()`).
   * The slim port reads `node.getComponentMeta()?.liveTextEditing`
   * via the typed surface. Ali-faithful typed this as a structural
   * shape; the slim port uses the auto-wired slim Node directly.
   */
  node: import('../../node').Node;
  rootElement: HTMLElement;
  event: MouseEvent;
}

type SaveHandler = { condition: (prop: unknown) => boolean; onSaveContent: (content: string, prop: { setValue(v: unknown): void }) => void };
type SpecificRule = (target: EditingTarget) => ({ propTarget?: string; propElement?: HTMLElement; selector?: string; onSaveContent?: (c: string, p: { setValue(v: unknown): void }) => void; mode?: string } | null);

let saveHandlers: SaveHandler[] = [];
function addLiveEditingSaveHandler(handler: SaveHandler): void { saveHandlers.push(handler); }
function clearLiveEditingSaveHandler(): void { saveHandlers = []; }

let specificRules: SpecificRule[] = [];
function addLiveEditingSpecificRule(rule: SpecificRule): void { specificRules.push(rule); }
function clearLiveEditingSpecificRule(): void { specificRules = []; }

/**
 * Place the caret at the click position. Slim port: uses the
 * standard `Document.createRange()` + `Selection.addRange()` (works
 * in both happy-dom and browser-native). Ali used the non-standard
 * `caretRangeFromPoint` which is WebKit-only.
 */
function setCaret(event: MouseEvent): void {
  const doc = event.view?.document;
  if (!doc) return;
  const target = event.target as HTMLElement;
  if (!target.firstChild) return;
  const range = doc.createRange();
  try {
    const text = target.firstChild;
    const offset = Math.min((text as Text).length ?? 0, Math.max(0, (text.textContent?.length ?? 0) / 2));
    range.setStart(text, offset);
    range.collapse(true);
    selectRange(doc, range);
  } catch {
    // Range construction can fail on detached nodes; silently no-op.
  }
}

function selectRange(doc: Document, range: Range): void {
  const selection = doc.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Ali-faithful: walk the root via a CSS selector and find the element
 * that contains the click target. Falls back to `querySelectorAll` if
 * the first match doesn't contain the target.
 */
function queryPropElement(rootElement: HTMLElement, targetElement: HTMLElement, selector?: string): HTMLElement | null {
  if (!selector) return null;
  let propElement: HTMLElement | null = selector === ':root'
    ? rootElement
    : (rootElement.querySelector(selector) as HTMLElement | null);
  if (!propElement) return null;
  if (!propElement.contains(targetElement)) {
    const all = Array.from(rootElement.querySelectorAll(selector)) as HTMLElement[];
    propElement = all.find((item) => item.contains(targetElement)) ?? null;
    if (!propElement) return null;
  }
  return propElement;
}

/**
 * The `LiveEditing` class. Ali-faithful 232-LoC port.
 */
export class LiveEditing {
  static addLiveEditingSpecificRule = addLiveEditingSpecificRule;
  static clearLiveEditingSpecificRule = clearLiveEditingSpecificRule;
  static addLiveEditingSaveHandler = addLiveEditingSaveHandler;
  static clearLiveEditingSaveHandler = clearLiveEditingSaveHandler;

  /** Slim port of `@obx.ref private _editing: Prop | null`. The slim
   *  `Prop` class is a Phase D-2 addition; for now the value is
   *  `unknown` and the consumer narrows via cast. */
  private _editing: unknown | null = null;
  private _editingObservable = (() => {
    // Lightweight local Observable-like so the getter re-runs consumers
    // (the slim bem-tool files subscribe to `host.liveEditing.editing`).
    let v: unknown | null = null;
    return {
      get: (): unknown | null => v,
      set: (next: unknown | null): void => { v = next; },
    };
  })();

  private _dispose?: () => void;
  private _save?: () => void;

  /**
   * Ali-faithful: enter live-editing mode for the target.
   * - emits `designer.builtinSimulator.liveEditing` on the editor event bus
   * - finds the right `setterPropElement` (via `data-setter-prop` dataset
   *   OR the `liveTextEditing` config OR a plugin-registered `SpecificRule`)
   * - sets `contenteditable="plaintext-only"`, focuses, places the caret
   * - listens for `focusout` / `keydown` to save + dispose
   */
  apply(target: EditingTarget): void {
    const { node, event, rootElement } = target;
    const targetElement = event.target as HTMLElement;
    // Phase E.7: read from node.getComponentMeta() (typed surface)
    // instead of the structural-cast chain. The slim port also
    // reads liveTextEditing from the typed meta. The `editor` slot
    // is sourced from the structural cast on the slim Node's document
    // (slim Node has no document yet — the editor lookup uses a
    // typed cast that returns undefined when absent).
    const meta = node.getComponentMeta();
    const liveTextEditing = (meta?.liveTextEditing as Array<{ propTarget?: string; selector?: string; onSaveContent?: (c: string, p: { setValue(v: unknown): void }) => void; mode?: string }> | undefined) ?? [];
    const editor = (node as unknown as { document?: { designer?: { editor?: { eventBus?: { emit: (e: string, p: unknown) => void } } } } }).document?.designer?.editor;
    const npm = meta?.npm;
    const selected = [npm?.package, npm?.componentName].filter(Boolean).join('-') || (meta as { componentName?: string } | null | undefined)?.componentName || '';
    editor?.eventBus?.emit('designer.builtinSimulator.liveEditing', { selected });

    let setterPropElement: HTMLElement | null = getSetterPropElement(targetElement, rootElement);
    let propTarget: string | undefined = setterPropElement?.dataset.setterProp;
    let matched: { propTarget?: string; propElement?: HTMLElement; onSaveContent?: (c: string, p: { setValue(v: unknown): void }) => void; mode?: string } | undefined;
    if (liveTextEditing.length > 0) {
      if (propTarget) {
        matched = liveTextEditing.find((c) => c.propTarget === propTarget);
      } else {
        matched = liveTextEditing.find((c) => {
          if (!c.selector) return false;
          setterPropElement = queryPropElement(rootElement, targetElement, c.selector);
          return !!setterPropElement;
        });
        propTarget = matched?.propTarget;
      }
    } else {
      for (const rule of specificRules) {
        const r = rule(target);
        if (r) { matched = r; break; }
      }
      if (matched) {
        propTarget = matched.propTarget;
        const m = matched as { propElement?: HTMLElement; selector?: string };
        setterPropElement = m.propElement ?? queryPropElement(rootElement, targetElement, m.selector);
      }
    }

    if (propTarget && setterPropElement) {
      const prop = (node as unknown as { getProp: (n: string, create?: boolean) => { setValue: (v: unknown) => void } }).getProp(propTarget, true);
      if (!prop) return;
      if (this._editing === prop) return;

      const onSaveContent = matched?.onSaveContent
        ?? saveHandlers.find((h) => h.condition(prop))?.onSaveContent
        ?? defaultSaveContent;

      setterPropElement.setAttribute(
        'contenteditable',
        matched?.mode && matched.mode !== 'plaintext' ? 'true' : 'plaintext-only',
      );
      setterPropElement.classList.add('engine-live-editing');
      setterPropElement.focus();
      setCaret(event);

      this._save = () => onSaveContent(setterPropElement!.innerText, prop);

      const keydown = (e: KeyboardEvent): void => {
        switch (e.code) {
          case 'Tab':
            setterPropElement?.blur();
            break;
          // Escape + Enter: ali has TODO; slim port is silent.
        }
      };
      const focusout = (): void => { this.saveAndDispose(); };
      setterPropElement.addEventListener('focusout', focusout);
      setterPropElement.addEventListener('keydown', keydown, true);

      this._dispose = () => {
        setterPropElement!.classList.remove('engine-live-editing');
        setterPropElement!.removeAttribute('contenteditable');
        setterPropElement!.removeEventListener('focusout', focusout);
        setterPropElement!.removeEventListener('keydown', keydown, true);
      };
      this._editing = prop;
      this._editingObservable.set(prop);
    }
  }

  get editing(): unknown { return this._editing; }
  /** Ali-faithful observable for the slim bem-tool subscription. */
  get editingObservable(): { get: () => unknown | null; set: (v: unknown | null) => void } {
    return this._editingObservable;
  }

  saveAndDispose(): void {
    if (this._save) {
      this._save();
      this._save = undefined;
    }
    this.dispose();
  }

  dispose(): void {
    if (this._dispose) {
      this._dispose();
      this._dispose = undefined;
    }
    this._editing = null;
    this._editingObservable.set(null);
  }
}

export type { SpecificRule, SaveHandler };
