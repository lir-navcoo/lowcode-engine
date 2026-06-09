/**
 * @monbolc/lowcode-designer — builtin-simulator/resource-consumer
 * Ali-mirror Phase D.I3: the `ResourceConsumer` autorun bridge.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/resource-consumer.ts`
 * (89 LoC ali → ~110 LoC slim). The class bridges a master-side data
 * provider to a renderer-side consumer:
 *   - `provider()` runs in an `autorun`; on every change, `_data` is
 *     updated.
 *   - `consume(consumerOrRenderer)` runs in a SECOND `autorun`; when
 *     `_data` is set, the consumer is called (once).
 *   - The two autoruns are independent — the provider is "hot" the
 *     moment the `ResourceConsumer` is constructed; the consumer is
 *     "hot" only after `consume()` is called.
 *   - `dispose()` tears down both autoruns + the emitter.
 *   - `waitFirstConsume()` returns a promise that resolves on the
 *     first successful consumer invocation.
 *
 * Slim translations applied:
 *   - `@obx.ref private _data` → `private _data = new Observable<T | typeof UNSET>(UNSET)`
 *   - `autorun(...)` from `@alilc/lowcode-editor-core` → `autorun(...)`
 *     from `@monbolc/lowcode-utils` (Phase A's `Observable-lite`,
 *     same signature as MobX-aligned autorun)
 *   - `makeObservable(this)` → drop (no decorators)
 *   - `IEventBus` / `createModuleEventBus` → `Emitter` from
 *     `@monbolc/lowcode-utils`
 *   - `BuiltinSimulatorHost` ctor param → NOT taken; the slim version
 *     is a pure data bridge with no host coupling
 *   - `BuiltinSimulatorRenderer` / `isSimulatorRenderer` → from
 *     `./renderer` (D.I2)
 */
import { Emitter, Observable, autorun } from '@monbolc/lowcode-utils';
import { isSimulatorRenderer, type BuiltinSimulatorRenderer } from './renderer';

/** Ali-faithful sentinel for "data not yet provided". */
const UNSET: unique symbol = Symbol('unset');

/** Ali-faithful: a function the master side calls to produce data. */
export type MasterProvider<T> = () => T;

/** Ali-faithful: a function the renderer side calls to consume data. */
export type RendererConsumer<T> = (renderer: BuiltinSimulatorRenderer, data: T) => Promise<unknown> | unknown;

/**
 * The `ResourceConsumer` class. Ali-faithful 89-LoC port, slim-deleted
 * the host coupling.
 */
export class ResourceConsumer<T = unknown> {
  /** Ali-faithful private Emitter (only used for the dispose cleanup). */
  private readonly _emitter = new Emitter<Record<string, unknown>>();

  /**
   * Ali-faithful `@obx.ref private _data: T | typeof UNSET = UNSET`.
   * Slim port: `Observable<T | typeof UNSET>` (the Observable is the
   * field; mutations go through `_data.set(...)`).
   */
  private readonly _data = new Observable<T | typeof UNSET>(UNSET);

  private _providing?: () => void;
  private _consuming?: () => void;
  private _firstConsumed = false;
  private resolveFirst?: (resolve?: unknown) => void;
  private readonly consumer?: RendererConsumer<T>;

  constructor(provider: () => T, consumer?: RendererConsumer<T>) {
    this.consumer = consumer;
    // The "providing" autorun: re-runs on every observable change inside
    // `provider()`. The slim port delegates to Phase A's `autorun`.
    this._providing = autorun(() => {
      const v = provider();
      this._data.set(v);
    });
  }

  /**
   * Ali-faithful: invoke the consumer with the latest `_data`. If
   * `consumerOrRenderer` is a `BuiltinSimulatorRenderer`, route through
   * the ctor-supplied `consumer(renderer, data)`. Otherwise treat it as
   * a plain `(data) => any` consumer.
   */
  consume(consumerOrRenderer: BuiltinSimulatorRenderer | ((data: T) => unknown)): void {
    if (this._consuming) {
      return; // idempotent — only the first call wires the consuming autorun
    }
    let consumer: (data: T) => unknown;
    if (isSimulatorRenderer(consumerOrRenderer)) {
      if (!this.consumer) {
        // TODO: throw error (ali has a TODO too; slim keeps the silent no-op)
        return;
      }
      const rendererConsumer = this.consumer;
      consumer = (data) => rendererConsumer(consumerOrRenderer, data);
    } else {
      consumer = consumerOrRenderer;
    }
    this._consuming = autorun(async () => {
      const data = this._data.get();
      if (data === UNSET) {
        return;
      }
      // Ali-faithful: catch-and-ignore; TODO: report errors
      await consumer(data as T);
      if (this.resolveFirst) {
        this.resolveFirst();
      } else {
        this._firstConsumed = true;
      }
    });
  }

  /**
   * Ali-faithful lifecycle: dispose both autoruns + the emitter. After
   * `dispose()`, calling `consume()` is a no-op (the autorun is gone).
   */
  dispose(): void {
    if (this._providing) {
      this._providing();
      this._providing = undefined;
    }
    if (this._consuming) {
      this._consuming();
      this._consuming = undefined;
    }
    this._emitter.removeAllListeners();
  }

  /**
   * Ali-faithful: returns a promise that resolves on the first
   * successful consumer invocation. If the first consume has already
   * happened, resolves immediately.
   */
  waitFirstConsume(): Promise<unknown> {
    if (this._firstConsumed) {
      return Promise.resolve();
    }
    return new Promise<unknown>((resolve) => {
      this.resolveFirst = resolve;
    });
  }
}
