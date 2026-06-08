/**
 * @monbolc/lowcode-shell — PublicDragon
 *
 * The host-facing wrapper around the inner `Dragon` (in
 * `@monbolc/lowcode-designer`). Two roles:
 *
 *   1. **Re-shape the inner API for plugin authors.** The inner
 *      Dragon is intentionally broad — sensors, events, the
 *      shake gate, the legacy `commit()` path, etc. The public
 *      surface is narrower: `dragging`, `boosting`, `sensors`,
 *      `boost`, `from`, `addSensor`, `removeSensor`, `onDragstart`,
 *      `onDrag`, `onDragend`, `cancel`. Each `onX` returns a
 *      disposer (ali-style) so plugin authors don't have to think
 *      about `Emitter` semantics.
 *
 *   2. **Generic over `<TNode, TLocateEvent>` so the same wrapper
 *      works for the engine core (`TNode = IPublicTypeNodeLike`,
 *      the schema-flavoured view) AND for hosts that bind the
 *      Dragon to a custom node shape.** The inner Dragon already
 *      has these generics; the wrapper simply carries them
 *      through to the public interface.
 *
 * Sapu stance: this wrapper is a **thin pass-through**. No
 * filtering, no proxy, no deprecation layer. The shell stays
 * ~85% smaller than ali by not having a `pluginContextApiAssembler`
 * reflection-style indirection. If a plugin author needs
 * something the inner Dragon has but the wrapper doesn't
 * (e.g. the v2.2-legacy `commit()`/`cancel()` events), they
 * can read `engine.project.dragon.events` directly — it's the
 * same instance, not a shim.
 */

import type { Dragon } from '@monbolc/lowcode-designer';
import type {
  IPublicModelDragon,
  IPublicTypeDragObject,
  IPublicTypeLocateEvent,
  IPublicTypeNodeLike,
  IPublicTypeSensor,
} from '@monbolc/lowcode-types';

/**
 * Public Dragon facade. Constructed via `PublicDragon.create(inner)`
 * so we don't have to expose the inner type's generics as a
 * public-API shape (the inner type can evolve without breaking
 * the public wrapper).
 */
export class PublicDragon<
  TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike,
  TLocateEvent extends IPublicTypeLocateEvent<TNode> = IPublicTypeLocateEvent<TNode>,
> implements IPublicModelDragon<TNode, TLocateEvent>
{
  /** The inner Dragon. Held by reference (not a copy), so any
   *  state mutation on the inner is immediately visible to the
   *  wrapper and vice versa. The wrapper just re-shapes the
   *  surface; it does not maintain parallel state. */
  private readonly _inner: Dragon<TNode, TLocateEvent>;

  private constructor(inner: Dragon<TNode, TLocateEvent>) {
    this._inner = inner;
  }

  /** Factory. The inner `Dragon` is a class in the designer
   *  package; we use a factory (not `new PublicDragon(...)`)
   *  to make the call site read as "wrap the inner Dragon" —
   *  no `class-with-private-ctor` trickery. */
  static create<
    TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike,
    TLocateEvent extends IPublicTypeLocateEvent<TNode> = IPublicTypeLocateEvent<TNode>,
  >(inner: Dragon<TNode, TLocateEvent>): PublicDragon<TNode, TLocateEvent> {
    return new PublicDragon(inner);
  }

  /* ---------------- State accessors ---------------- */

  get dragging(): boolean {
    return this._inner.isDragging;
  }

  get boosting(): boolean {
    return this._inner.isBoosting;
  }

  get sensors(): readonly IPublicTypeSensor<TNode>[] {
    return this._inner.sensors;
  }

  /* ---------------- Instrumented-mode API ---------------- */

  boost(dragObject: IPublicTypeDragObject<TNode>, e: MouseEvent, fromRglNode?: unknown): void {
    // The inner Dragon's `boost(dragObject, e, fromRglNode?)` overload
    // has the same shape; the `fromRglNode` argument is reserved for
    // RGL (sapu ships without RGL) so we just pass it through.
    this._inner.boost(dragObject, e, fromRglNode);
  }

  from(
    shell: HTMLElement,
    boost: (e: MouseEvent) => IPublicTypeDragObject<TNode> | null,
  ): () => void {
    return this._inner.from(shell, boost);
  }

  /* ---------------- Sensor registry ---------------- */

  addSensor(sensor: IPublicTypeSensor<TNode>): void {
    this._inner.addSensor(sensor);
  }

  removeSensor(name: string): void {
    this._inner.removeSensor(name);
  }

  /* ---------------- Ali-style events (returns disposers) ---------------- */

  onDragstart(
    fn: (e: { readonly dragObject: IPublicTypeDragObject<TNode>; readonly copy: boolean }) => void,
  ): () => void {
    return this._inner.events.on('dragstart', fn);
  }

  onDrag(
    fn: (e: {
      readonly dragObject: IPublicTypeDragObject<TNode>;
      readonly locateEvent: TLocateEvent;
      readonly copy: boolean;
    }) => void,
  ): () => void {
    // The inner Dragon's `drag` event payload doesn't include
    // `locateEvent` (ali's old payload is split across `drag`
    // and `move`). For back-compat, we synthesise a `locateEvent`
    // from the event's own `x`/`y` + the active sensor (when
    // present). Using the event's own coords — NOT
    // `this._inner.x` / `this._inner.y` — is deliberate: the
    // inner's `x`/`y` getters only update on `move()` /
    // `_handleMove()`, so a `drag` event emitted by direct
    // emitter access (tests, future refactors) would see
    // stale coords. The event payload is the source of truth.
    return this._inner.events.on('drag', (e) => {
      const dragObject = e.dragObject;
      const sensor = this._inner.activeSensor ?? undefined;
      const locateEvent = {
        globalX: e.x,
        globalY: e.y,
        canvasX: e.x,
        canvasY: e.y,
        clientX: e.x,
        clientY: e.y,
        target: null,
        dragObject,
        ...(sensor !== undefined ? { sensor } : {}),
        // originalEvent is intentionally omitted — the inner
        // Dragon doesn't carry it through to the public event
        // (would couple the wrapper to a MouseEvent reference
        // that's stale by the time the listener fires).
      } as unknown as TLocateEvent;
      fn({ dragObject: e.dragObject, copy: e.copy, locateEvent });
    });
  }

  onDragend(
    fn: (e: {
      readonly dragObject: IPublicTypeDragObject<TNode>;
      readonly copy: boolean;
      readonly cancelled: boolean;
    }) => void,
  ): () => void {
    return this._inner.events.on('dragend', fn);
  }

  /* ---------------- Cancel ---------------- */

  cancel(): void {
    this._inner.cancel();
  }
}
