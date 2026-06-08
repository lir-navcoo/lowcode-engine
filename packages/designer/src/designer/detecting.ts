/**
 * @monbolc/lowcode-designer — Detecting (Phase B ali-mirror)
 *
 * Ali-faithful port of
 * `alibaba/lowcode-engine/packages/designer/src/designer/detecting.ts`.
 * Tracks the currently-hovered node (the "detecting" node) and
 * emits `detectingChange` on transition.
 *
 * Sapu's slim design: NO MobX decorators. Plain class fields +
 * a single `Emitter` (the `change` channel). The ali-faithful
 * `enable` toggle controls whether the tracker is on. When
 * `enable=false`, the current node is cleared.
 *
 * `Project.detectingId` (sapu P2.2) already exposes a similar
 * surface — the Detecting class is the lower-level helper ali
 * uses internally, and it's what plugins listen to via
 * `onDetectingChange(fn)`. Coexist: Project wires Detecting
 * to its own `detectingChanged` event.
 */
import { Emitter, type EventMap } from '@monbolc/lowcode-utils';

const DETECTING_CHANGE_EVENT = 'detectingChange';

export interface DetectingEvents extends EventMap {
  detectingChange: { current: unknown };
}

export class Detecting<TNode = unknown> {
  readonly events = new Emitter<DetectingEvents>();
  private _enable = true;
  private _current: TNode | null = null;
  /**
   * Optional equality function for "is this the same node as
   * the current?". Defaults to `===` (reference equality). Ali
   * uses MobX's `comparer.shallow` for arrays; sapu uses a
   * user-supplied predicate so the helper stays plain-class
   * and the React layer (Phase D) can pass `comparer.shallow`
   * if it needs to.
   */
  readonly equals: (a: TNode | null, b: TNode | null) => boolean;

  constructor(opts?: { equals?: (a: TNode | null, b: TNode | null) => boolean }) {
    this.equals = opts?.equals ?? ((a, b) => a === b);
  }

  /** Ali-faithful. */
  get enable(): boolean { return this._enable; }
  set enable(flag: boolean) {
    this._enable = flag;
    if (!flag) this._current = null;
  }

  /** Ali-faithful. */
  get current(): TNode | null { return this._current; }

  /** Ali-faithful. Captures a new hover target. */
  capture(node: TNode | null): void {
    if (!this.equals(this._current, node)) {
      this._current = node;
      this.events.emit(DETECTING_CHANGE_EVENT, { current: this.current });
    }
  }

  /** Ali-faithful. Releases a hover (e.g. on pointerleave). */
  release(node: TNode | null): void {
    if (this.equals(this._current, node)) {
      this._current = null;
      this.events.emit(DETECTING_CHANGE_EVENT, { current: this.current });
    }
  }

  /**
   * Ali-faithful. Used when the pointer leaves the canvas entirely
   * — clears the current node if it belongs to the given document.
   */
  leave(document: { readonly id?: unknown } | undefined): void {
    if (this.current && (this.current as { document?: unknown }).document === document) {
      this._current = null;
    }
  }

  /** Ali-faithful: subscribe to hover transitions. */
  onDetectingChange(fn: (node: TNode | null) => void): () => void {
    type P = { current: TNode | null };
    const handler = (e: unknown): void => fn((e as P).current);
    this.events.on(DETECTING_CHANGE_EVENT, handler as (e: { current: unknown }) => void);
    return () => { this.events.off(DETECTING_CHANGE_EVENT, handler as (e: { current: unknown }) => void); };
  }
}
