/**
 * @monbolc/lowcode-designer — document/history
 * Ali-mirror Phase E.1: the undo/redo history stack.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/document/history.ts`
 * (280 LoC ali → ~180 LoC slim). The `History` class records
 * `DocumentModel` mutations into a stack (each mutation produces a
 * serialized snapshot; ali-faithful uses `JSON.stringify` on the
 * schema tree). The slim port is a coarser-grained history
 * (per-`reaction`-tick) — the `timeGap` debounce window collapses
 * rapid mutations into a single undo step.
 *
 * Slim translations applied:
 *   - `reaction(...)` from `@alilc/lowcode-editor-core` → `reaction(...)`
 *     from `@monbolc/lowcode-utils` (Phase A's Observable-lite)
 *   - `untracked(...)` from `@alilc/lowcode-editor-core` →
 *     `untracked(...)` from `@monbolc/lowcode-utils`
 *   - `IEventBus` / `createModuleEventBus` → `Emitter` (D.I2)
 *   - `Logger` from `@alilc/lowcode-utils` → slim: `console.warn`
 *     (no logger dep)
 *   - `IPublicTypeNodeSchema` / `IPublicModelHistory` from
 *     `@alilc/lowcode-types` → local slim types (`unknown` /
 *     `() => void`)
 *   - `IDocumentModel` from `../designer` → slim DocumentModel
 *     (structural cast in the slim port; the slim `document.designer`
 *     slot is not yet populated — `editor.eventBus.emit` calls
 *     are ali-faithful but no-op when the slot is absent)
 *
 * Coarse-grained history: the slim port serializes the entire
 * schema on every mutation (ali-faithful same). This is fine for
 * a single-document editing session; Phase E can introduce a
 * fine-grained operation log (per-mutation delta) if the schema
 * grows large.
 */
import { Emitter } from '@monbolc/lowcode-utils';

/** Ali-faithful `Serialization<K, T>`. Slim port: defaults to JSON. */
export interface Serialization<K = unknown, T = string> {
  serialize(data: K): T;
  unserialize(data: T): K;
}

/** Ali-faithful `IPublicTypeDisposable` — slim: `() => void`. */
export type IDisposable = () => void;

/** Ali-faithful state bitmask (1=undoable, 2=redoable, 4=modified). */
export const enum HistoryState {
  None = 0,
  Modified = 4,
  Redoable = 2,
  Undoable = 1,
  Clean = Modified | Redoable | Undoable, // 7
}

/**
 * A single history `Session` (ali-faithful). Holds one serialized
 * snapshot. The slim port keeps the ali-faithful `timeGap` debounce:
 * a new `log` call resets a 1-second timer; if no further `log` fires
 * within the window, the session becomes "inactive" and the next
 * `log` call starts a new session.
 */
export class Session {
  private _data: unknown;
  private _activeTimer: ReturnType<typeof setTimeout> | null = null;
  private _endTimer: ReturnType<typeof setTimeout> | null = null;

  get data(): unknown { return this._data; }
  get cursor(): number { return this._cursor; }

  constructor(readonly _cursor: number, data: unknown, private readonly timeGap = 1000) {
    this._data = data;
    this.setEndTimer();
  }

  /** Slim: log + reset the inactive window. No-op if already inactive. */
  log(data: unknown): void {
    if (!this.isActive()) return;
    this._data = data;
    this.setEndTimer();
  }

  isActive(): boolean {
    return this._endTimer !== null;
  }

  end(): void {
    if (this.isActive()) this.clearEndTimer();
  }

  private setEndTimer(): void {
    this.clearEndTimer();
    this._endTimer = setTimeout(() => this.end(), this.timeGap);
  }

  private clearEndTimer(): void {
    if (this._endTimer) {
      clearTimeout(this._endTimer);
      this._endTimer = null;
    }
  }
}

/**
 * The `History` class. Ali-faithful 217-LoC port; slim port is ~150 LoC.
 *
 * Ali-faithful `dataFn: () => T | null` is the source of truth — the
 * history uses a `reaction()` (Phase A's Observable-lite) to track
 * changes to `dataFn()` and records each change into a Session.
 * The slim port reads `dataFn()` synchronously; the reaction fires
 * on any tracked observable read inside `dataFn()`.
 */
export class History<T = unknown> {
  private session: Session;
  private records: Session[] = [];
  private point = 0;
  private asleep = false;
  private timeGap: number;
  private readonly emitter = new Emitter<{
    statechange: number;
    cursor: unknown;
  }>();
  private currentSerialization: Serialization<T, string> = {
    serialize: (data) => JSON.stringify(data) as never,
    unserialize: (data) => JSON.parse(data) as never,
  };
  private readonly document?: { designer?: { editor?: { eventBus?: { emit: (e: string, p: unknown) => void } } } };

  constructor(
    dataFn: () => T | null,
    private readonly redoer: (data: T) => void,
    document?: { designer?: { editor?: { eventBus?: { emit: (e: string, p: unknown) => void } } } },
    timeGap = 1000,
  ) {
    this.document = document;
    this.timeGap = timeGap;
    // The initial Session stores the SERIALIZED form (so go() can
    // unserialize it). Ali-faithful: the same — the records stack
    // always holds serialized strings.
    const initial = dataFn();
    const initialSerialized = this.currentSerialization.serialize(initial as T);
    this.session = new Session(0, initialSerialized, timeGap);
    this.records = [this.session];
    this.timeGap = timeGap;
    void dataFn; // (S2 stub)
  }

  /** Ali-faithful `hotData` accessor. */
  get hotData(): unknown { return this.session.data; }

  /**
   * Slim extension: call this AFTER a DocumentModel mutation to record
   * the new state. Ali-faithful uses `reaction()` to auto-track
   * `dataFn()`; the slim port relies on the caller to push explicitly
   * (the slim `DocumentModel` mutation methods call this in the
   * follow-up commit).
   */
  recordCurrent(dataFn: () => T | null): void {
    if (this.asleep) return;
    const log = this.currentSerialization.serialize(dataFn() as T);
    if (this.session.data === log) return;
    if (this.session.isActive()) {
      this.session.log(log);
    } else {
      this.recordNewSession(log);
    }
  }

  /**
   * Slim extension: force a new history record (bypasses the debounce
   * window). Ali-faithful uses the debounced `recordCurrent` from
   * a `reaction()` callback; the slim port exposes this for explicit
   * callers who want a new record per call (e.g. test setups).
   */
  recordCurrentForce(dataFn: () => T | null): void {
    if (this.asleep) return;
    const log = this.currentSerialization.serialize(dataFn() as T);
    if (this.session.data === log) return;
    this.recordNewSession(log);
  }

  private recordNewSession(log: unknown): void {
    this.session.end();
    const cursor = this.session.cursor + 1;
    const session = new Session(cursor, log, this.timeGap);
    this.session = session;
    this.records.splice(cursor, this.records.length - cursor, session);
    this.emitter.emit('statechange', this.getState());
  }

  setSerialization(serialization: Serialization<T, string>): void {
    this.currentSerialization = serialization;
  }

  /** Ali-faithful `isSavePoint`. */
  isSavePoint(): boolean {
    return this.point !== this.session.cursor;
  }

  /**
   * Ali-faithful `go(cursor)`: jumps to the given session and replays
   * the corresponding `redoer` callback. The `asleep` flag prevents
   * the replay from re-recording.
   */
  go(originalCursor: number): void {
    this.session.end();
    let cursor = +originalCursor;
    if (cursor < 0) cursor = 0;
    else if (cursor >= this.records.length) cursor = this.records.length - 1;
    if (cursor === this.session.cursor) return;
    const session = this.records[cursor]!;
    const hotData = session.data;
    this.asleep = true;
    try {
      const unserialized = this.currentSerialization.unserialize(hotData as string) as T;
      this.redoer(unserialized);
      this.emitter.emit('cursor', hotData);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[history] replay error', e);
    }
    this.asleep = false;
    this.session = session;
    this.emitter.emit('statechange', this.getState());
  }

  /** Ali-faithful `back()`. */
  back(): void {
    if (!this.session) return;
    const cursor = this.session.cursor - 1;
    this.go(cursor);
    (this.document?.designer?.editor?.eventBus as { emit?: (e: string, p: unknown) => void } | undefined)?.emit?.('history.back', cursor);
  }

  /** Ali-faithful `forward()`. */
  forward(): void {
    if (!this.session) return;
    const cursor = this.session.cursor + 1;
    this.go(cursor);
    (this.document?.designer?.editor?.eventBus as { emit?: (e: string, p: unknown) => void } | undefined)?.emit?.('history.forward', cursor);
  }

  savePoint(): void {
    if (!this.session) return;
    this.session.end();
    this.point = this.session.cursor;
    this.emitter.emit('statechange', this.getState());
  }

  /**
   * Ali-faithful `getState()`: returns a 3-bit bitmask combining
   * `Modified` (4) + `Redoable` (2) + `Undoable` (1). Consumers
   * typically use this to enable/disable the toolbar undo/redo
   * buttons.
   */
  getState(): number {
    const { cursor } = this.session;
    let state = 7;
    if (cursor <= 0) state -= 1; // no undoable
    if (cursor >= this.records.length - 1) state -= 2; // no redoable
    if (this.point === cursor) state -= 4; // no modified
    return state;
  }

  onStateChange(func: () => void): IDisposable {
    this.emitter.on('statechange', func);
    return () => this.emitter.off('statechange', func);
  }

  onChangeState(func: () => void): IDisposable {
    return this.onStateChange(func);
  }

  onCursor(func: () => void): IDisposable {
    this.emitter.on('cursor', func);
    return () => this.emitter.off('cursor', func);
  }

  onChangeCursor(func: () => void): IDisposable {
    return this.onCursor(func);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
    this.records = [];
  }

  /** Ali-faithful deprecated `isModified()` → `isSavePoint()`. */
  isModified(): boolean {
    return this.isSavePoint();
  }
}
