/**
 * @monbolc/lowcode-designer — Dragon
 *
 * Drag state machine. Tracks:
 *   - which existing nodes are being dragged (move), OR
 *   - which component meta is being dragged from a palette (boost)
 *   - the current pointer position
 *   - the active drop-target sensor (if any) and its computed location
 *
 * Generic over `<TNode, TLocateEvent>` so plugin authors can bind
 * to any node-like shape without coupling to the internal `Node`
 * class. The default `<TNode = IPublicTypeNodeLike,
 * TLocateEvent = IPublicTypeLocateEvent<TNode>>` keeps the legacy
 * `string`-id usage working (every `IPublicTypeNodeLike` has
 * `id: string`).
 *
 * Two API styles coexist:
 *
 *   1. **Manual** (legacy, v2.2): the host wires `pointerdown` /
 *      `pointermove` / `pointerup` itself and calls
 *      `dragon.start(nodeId, x, y)` / `dragon.boost(meta, x, y)` /
 *      `dragon.move(x, y, target)` / `dragon.commit()` /
 *      `dragon.cancel()`. The Dragon is a pure state machine.
 *
 *   2. **Instrumented** (new, v2.3): the host calls
 *      `dragon.boost(dragObject, e)` (or `dragon.from(shell, …)`)
 *      and the Dragon binds `mousemove` / `mouseup` / `keydown` on
 *      `document` itself. Adds a 4px shake gate (dragstart fires
 *      only after the pointer moves past 4px from the down point),
 *      ESC cancellation, and the ali-style
 *      `dragstart | drag | dragend` events alongside the legacy
 *      `start | startBoost | move | cancel | cancelBoost | drop | dropBoost`.
 *
 * Inspired by alibaba/lowcode-engine v1.3.2's
 * `designer/src/designer/dragon.ts` (639 lines) — slimmed to what
 * sapu actually uses, plus the public/inner split.
 */

import { Emitter } from '@monbolc/lowcode-utils';
import type {
  IPublicTypeDragObject,
  IPublicTypeLocateEvent,
  IPublicTypeNodeLike,
  IPublicTypeSensor,
  JSONValue,
} from '@monbolc/lowcode-types';

// ---------- Constants ----------

/** Pixels the pointer must move from the down point before the
 *  gesture is considered a drag (not a click). Ali uses 4. */
const SHAKE_DISTANCE = 4;
const SHAKE_DISTANCE_SQ = SHAKE_DISTANCE * SHAKE_DISTANCE;

/** Synthetic (0, 0) mouse-leave events should be ignored. */
function isInvalidPoint(x: number, y: number): boolean {
  return x === 0 && y === 0;
}

// ---------- Back-compat types (legacy v2.2 API) ----------

/** Legacy placement enum. Sapu's host reads this from `state.dropTarget`. */
export interface DropTarget {
  parentId: string | null;
  index: number;
  placement: 'before' | 'after' | 'inside';
}

/** Legacy palette → canvas payload. */
export interface BoostMeta {
  componentName: string;
  initialProps?: Record<string, JSONValue>;
}

/** Legacy state shape (v2.2). Kept as a public accessor for
 *  back-compat. New code should use `dragon.dragObject` +
 *  `dragon.copy` + `dragon.activeSensor` instead. */
export interface DragonState {
  draggingNodeId: string | null;
  boost: BoostMeta | null;
  x: number;
  y: number;
  dropTarget: DropTarget | null;
}

// ---------- Events ----------

/**
 * Event surface. The first three are the new ali-style events
 * (added in v2.3); the rest are the legacy v2.2 events kept for
 * back-compat until v2.4 (per the engine's deprecation policy).
 *
 * Every event payload carries the same `dragObject` (so plugins
 * can read what was being dragged) and `copy: boolean` (whether
 * the user held alt/ctrl).
 */
export interface DragonEvents<TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike> {
  // === New (v2.3) — ali-style ===
  /** Gesture started AFTER the shake gate trips. */
  dragstart: { dragObject: IPublicTypeDragObject<TNode>; copy: boolean };
  /** Per-tick move event while the gesture is active. */
  drag: { dragObject: IPublicTypeDragObject<TNode>; copy: boolean; x: number; y: number };
  /** Gesture ended (drop or cancel). */
  dragend: { dragObject: IPublicTypeDragObject<TNode>; copy: boolean; cancelled: boolean };

  // === Legacy (v2.2) — kept until v2.4 ===
  /** Move-mode start (immediate on `start(nodeId, x, y)`). */
  start: { nodeId: string; x: number; y: number };
  /** Boost-mode start (immediate on `boost(meta, x, y)`). */
  startBoost: { meta: BoostMeta };
  /** Pointer move (manual mode). */
  move: { x: number; y: number; dropTarget: DropTarget | null };
  /** Move-mode cancel (no drop target). */
  cancel: { nodeId: string };
  /** Boost-mode cancel. */
  cancelBoost: { meta: BoostMeta };
  /** Move-mode drop. */
  drop: { nodeId: string; target: DropTarget };
  /** Boost-mode drop. */
  dropBoost: { meta: BoostMeta; target: DropTarget };

  /** Index signature for `Emitter<EventMap>` compatibility. */
  [event: string]: unknown;
}

// ---------- Dragon class ----------

type Mode = 'idle' | 'move' | 'boost' | 'any';

export class Dragon<
  TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike,
  TLocateEvent extends IPublicTypeLocateEvent<TNode> = IPublicTypeLocateEvent<TNode>,
> {
  readonly events = new Emitter<DragonEvents<TNode>>();

  // ---------- Sensor registry ----------

  private _sensors: IPublicTypeSensor<TNode>[] = [];
  /**
   * Phase C.AD: ali-faithful `lastSensor` memory. The Dragon
   * keeps the previously-active sensor across `handleMove`
   * calls so a brief pointer-leave from a sensor's territory
   * (e.g. crossing between two adjacent sensor regions) does
   * NOT lose the sensor — the next move falls back to
   * `lastSensor` when no current sensor's `isEnter` fires.
   * Cleared on `cancel()` / successful `drop()` / sensor
   * removal.
   */
  private _lastSensor: IPublicTypeSensor<TNode> | null = null;
  get sensors(): readonly IPublicTypeSensor<TNode>[] {
    return this._sensors;
  }
  private _activeSensor: IPublicTypeSensor<TNode> | null = null;
  get activeSensor(): IPublicTypeSensor<TNode> | null {
    return this._activeSensor;
  }

  // ---------- Gesture state ----------

  private _mode: Mode = 'idle';
  private _dragObject: IPublicTypeDragObject<TNode> | null = null;
  private _copy = false;
  private _x = 0;
  private _y = 0;
  private _dropTarget: DropTarget | null = null;

  // Shake gate (instrumented mode only)
  private _shaken = false;
  private _startX = 0;
  private _startY = 0;

  // Bound listeners (instrumented mode only)
  private _instrumented = false;
  private _boundMove: ((e: MouseEvent) => void) | null = null;
  private _boundUp: ((e: MouseEvent) => void) | null = null;
  private _boundKey: ((e: KeyboardEvent) => void) | null = null;

  // ---------- State accessors ----------

  /** Back-compat state (v2.2 shape). New code prefers `dragObject`
   *  + `copy` + `activeSensor`. */
  get state(): DragonState {
    let draggingNodeId: string | null = null;
    let boost: BoostMeta | null = null;
    if (this._dragObject) {
      if (this._dragObject.type === 'Node' && this._dragObject.nodes.length > 0) {
        draggingNodeId = this._dragObject.nodes[0]?.id ?? null;
      } else if (this._dragObject.type === 'NodeData') {
        boost = this._dragObject.data;
      }
    }
    return {
      draggingNodeId,
      boost,
      x: this._x,
      y: this._y,
      dropTarget: this._dropTarget,
    };
  }

  get isDragging(): boolean {
    return this._mode !== 'idle';
  }
  get isBoosting(): boolean {
    return this._mode === 'boost';
  }
  get copy(): boolean {
    return this._copy;
  }
  get dragObject(): IPublicTypeDragObject<TNode> | null {
    return this._dragObject;
  }
  get x(): number {
    return this._x;
  }
  get y(): number {
    return this._y;
  }
  get dropTarget(): DropTarget | null {
    return this._dropTarget;
  }

  // ---------- Sensors ----------

  addSensor(sensor: IPublicTypeSensor<TNode>): void {
    if (this._sensors.some((s) => s.name === sensor.name)) {
      throw new Error(`[Dragon] sensor "${sensor.name}" is already registered`);
    }
    this._sensors.push(sensor);
  }

  removeSensor(name: string): void {
    const before = this._sensors.length;
    this._sensors = this._sensors.filter((s) => s.name !== name);
    if (before !== this._sensors.length && this._activeSensor?.name === name) {
      this._activeSensor = null;
    }
    if (this._lastSensor?.name === name) {
      this._lastSensor = null;
    }
  }

  /**
   * Phase C.AD: ali-faithful `chooseSensor(e)`. Pick the
   * active sensor for a drag-move event. Three-step algorithm
   * (matches `alibaba/lowcode-engine/packages/designer/src/designer/dragon.ts:468-491`):
   *
   *   1. Walk `_sensors` in registration order. The FIRST
   *      sensor whose `isEnter(fixed)` fires AND whose
   *      `sensorAvailable` is not `false` becomes the active
   *      sensor. Ali-faithful.
   *   2. If NO current sensor matches, fall back to
   *      `_lastSensor` (the sensor that was active on the
   *      PREVIOUS move). This is the gap the slim sensor
   *      loop left open: a brief pointer-leave would have
   *      flipped `_activeSensor` to `null`, then the
   *      next move would re-pick (possibly the same sensor,
   *      possibly a different one) — visual UX flicker
   *      for any sensor that holds external state
   *      (highlight rings, hover indicators).
   *   3. If `_lastSensor` is also unavailable (or was
   *      removed), `_activeSensor` is `null` for this
   *      move; the host's `_dropTarget` stays as it was
   *      (no flicker from `null`-ing a previously-set
   *      drop target).
   *
   * On sensor change, calls `_lastSensor.deactiveSensor()`
   * (via `_safeDeactivate` so a missing / throwing
   * implementation doesn't break the dispatch).
   *
   * **Cross-frame note**: sapu has no iframe simulator, so
   * ali's `masterSensors` (the iframe-content-frame sensors)
   * are not relevant. The slim version is the in-canvas-only
   * subset of ali's chooseSensor.
   */
  chooseSensor(e: MouseEvent): void {
    // 1. Try a fresh pick: walk sensors, first matching isEnter wins.
    let picked: IPublicTypeSensor<TNode> | null = null;
    let pickedFixed: IPublicTypeLocateEvent<TNode> | null = null;
    for (const sensor of this._sensors) {
      if (sensor.sensorAvailable === false) continue;
      const fixed = sensor.fixEvent(e);
      if (sensor.isEnter(fixed)) {
        picked = sensor;
        pickedFixed = fixed;
        break;
      }
    }
    // 2. No fresh pick → fall back to the last active sensor.
    //    This is the gap the slim loop left: a brief pointer-
    //    leave would lose the sensor entirely.
    if (!picked) {
      picked = this._lastSensor;
      pickedFixed = picked ? picked.fixEvent(e) : null;
    }
    // 3. No change → bail (no deactive, no re-assign).
    if (picked === this._activeSensor) return;
    // Sensor changed: deactivate the old one (best-effort).
    this._safeDeactivate(this._activeSensor);
    // Update `_lastSensor` BEFORE `_activeSensor` so the next
    // call's lastSensor fallback re-picks the sensor we just
    // made active. (If we did it after, the fallback on the
    // NEXT call would re-pick the just-deactivated sensor,
    // which is also fine, but doing it before is the natural
    // "remember what we're about to make active" semantics.)
    this._lastSensor = picked ?? this._activeSensor;
    this._activeSensor = picked;
    // The `_dropTarget` is recomputed by the caller from
    // `picked.locate(pickedFixed)`. We don't touch it here.
  }

  /**
   * Best-effort deactivation. Wraps `sensor?.deactiveSensor?.()`
   * so a missing or throwing implementation doesn't break the
   * dispatch chain. Errors are swallowed to console (the
   * sensor is responsible for its own cleanup; the Dragon's
   * job is just to not crash on a bad sensor).
   */
  private _safeDeactivate(sensor: IPublicTypeSensor<TNode> | null): void {
    if (!sensor) return;
    try {
      sensor.deactiveSensor?.();
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.error('[Dragon] sensor.deactiveSensor threw:', err);
      }
    }
  }

  // ---------- New instrumented API (v2.3) ----------

  /**
   * Start a drag programmatically. The Dragon binds `mousemove` +
   * `mouseup` + `keydown` on `document` and drives the gesture to
   * completion. The shake gate (4px) means `dragstart` fires AFTER
   * the pointer moves; the legacy `start` / `startBoost` events
   * still fire immediately for v2.2 back-compat.
   *
   * `fromRglNode` is reserved for the RGL Free-Layout plugin; sapu
   * ships without RGL, so the argument is a no-op.
   */
  boost(dragObject: IPublicTypeDragObject<TNode>, e: MouseEvent, _fromRglNode?: unknown): void;

  /**
   * Back-compat: manual boost without DOM binding. The host wires
   * the pointer events itself and uses `move(x, y, target)` +
   * `commit()` to drive the gesture. Deprecated in v2.3; the
   * default preset plugins in v2.4 will use `boost(dragObject, e)`.
   */
  boost(meta: BoostMeta, x: number, y: number): void;

  boost(
    arg1: IPublicTypeDragObject<TNode> | BoostMeta,
    arg2: MouseEvent | number,
    arg3?: number,
  ): void {
    if (this._mode !== 'idle') return;
    if (this._isDragObject(arg1)) {
      // New API
      this._beginGesture(arg1, arg2 as MouseEvent, true);
    } else {
      // Legacy API: synthesise a MouseEvent with the right shape
      const x = arg2 as number;
      const y = (arg3 as number | undefined) ?? 0;
      this._beginGesture(
        { type: 'NodeData', data: arg1 as BoostMeta },
        { clientX: x, clientY: y, altKey: false, ctrlKey: false, button: 0 } as MouseEvent,
        false, // no DOM binding
      );
    }
  }

  /**
   * Bind a DOM element as a drag source. The Dragon installs
   * `mousedown` on `shell`; when fired, the host's `toDragObject`
   * callback converts the event into a `DragObject` and the
   * Dragon takes over. Returns a disposer.
   *
   * The callback may return `null` to refuse the drag (e.g. a
   * "drag disabled" UI state). Only left-button (button === 0)
   * mousedowns start a drag.
   */
  from(
    shell: HTMLElement,
    toDragObject: (e: MouseEvent) => IPublicTypeDragObject<TNode> | null,
  ): () => void {
    const onDown = (e: MouseEvent): void => {
      if (this._mode !== 'idle') return;
      if (e.button !== 0) return;
      const obj = toDragObject(e);
      if (!obj) return;
      this._beginGesture(obj, e, true);
    };
    shell.addEventListener('mousedown', onDown);
    return () => shell.removeEventListener('mousedown', onDown);
  }

  // ---------- Legacy manual API (v2.2) ----------

  /** Start a move-mode drag. The host wires pointer events itself.
   *
   * Optional 4th arg `e` is the source PointerEvent — the host
   * passes it through so alt/ctrl-key state propagates and the
   * resulting `copy: boolean` on the `dragstart` payload matches
   * what the user actually pressed. Ali-faithful (ali's dragon
   * also reads `e.altKey` at gesture start). Without `e`, alt is
   * treated as `false` (legacy v2.2 behavior, kept for back-compat
   * — hosts that pass only x/y still work).
   */
  start(nodeId: string, x: number, y: number, e?: { altKey?: boolean; ctrlKey?: boolean }): void {
    if (this._mode !== 'idle') return;
    this._beginGesture(
      {
        type: 'Node',
        nodes: [{ id: nodeId, componentName: '' } as unknown as TNode],
      },
      {
        clientX: x,
        clientY: y,
        altKey: e?.altKey ?? false,
        ctrlKey: e?.ctrlKey ?? false,
        button: 0,
      } as MouseEvent,
      false,
    );
  }

  /** Update position + (optionally) drop target. The host computes
   *  the drop target from the pointer's hit-test. */
  move(x: number, y: number, dropTarget?: DropTarget | null): void {
    if (this._mode === 'idle') return;
    this._x = x;
    this._y = y;
    this._dropTarget = dropTarget ?? null;
    this.events.emit('move', { x, y, dropTarget: this._dropTarget });
  }

  /**
   * Commit the in-flight drag. Returns a discriminated union so
   * the caller can `switch` on `result.kind`:
   *   - `'move'` for a successful node-move
   *   - `'boost'` for a successful palette → canvas drop
   *   - `null` if no gesture is active OR no drop target was set
   *     (the legacy `cancel` / `cancelBoost` event fires in the
   *     latter case).
   */
  commit():
    | { kind: 'move'; nodeId: string; target: DropTarget }
    | { kind: 'boost'; meta: BoostMeta; target: DropTarget }
    | null {
    if (this._mode === 'idle') return null;
    const obj = this._dragObject;
    if (!obj) return null;

    const target = this._dropTarget;
    let result:
      | { kind: 'move'; nodeId: string; target: DropTarget }
      | { kind: 'boost'; meta: BoostMeta; target: DropTarget }
      | null = null;

    if (obj.type === 'Node' && obj.nodes.length > 0) {
      const nodeId = obj.nodes[0]?.id;
      if (nodeId !== undefined) {
        if (target) {
          this.events.emit('drop', { nodeId, target });
          result = { kind: 'move', nodeId, target };
        } else {
          this.events.emit('cancel', { nodeId });
        }
      }
    } else if (obj.type === 'NodeData') {
      if (target) {
        this.events.emit('dropBoost', { meta: obj.data, target });
        result = { kind: 'boost', meta: obj.data, target };
      } else {
        this.events.emit('cancelBoost', { meta: obj.data });
      }
    }

    this._reset();
    return result;
  }

  /** Cancel an in-flight drag. */
  cancel(): void {
    if (this._mode === 'idle') return;
    this._endGesture(true);
  }

  // ---------- Internals ----------

  private _isDragObject(x: unknown): x is IPublicTypeDragObject<TNode> {
    return (
      !!x &&
      typeof x === 'object' &&
      'type' in (x as Record<string, unknown>) &&
      typeof (x as { type: unknown }).type === 'string' &&
      ['Node', 'NodeData', 'Any'].includes((x as { type: string }).type)
    );
  }

  private _beginGesture(
    dragObject: IPublicTypeDragObject<TNode>,
    e: MouseEvent,
    instrumented: boolean,
  ): void {
    this._mode = this._inferMode(dragObject);
    this._dragObject = dragObject;
    this._copy = e.altKey || e.ctrlKey;
    this._x = e.clientX;
    this._y = e.clientY;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._shaken = false;
    this._dropTarget = null;
    this._instrumented = instrumented;

    // Legacy v2.2 start events (fire immediately for back-compat).
    if (this._mode === 'move' && dragObject.type === 'Node') {
      const firstId = dragObject.nodes[0]?.id;
      if (firstId !== undefined) {
        this.events.emit('start', { nodeId: firstId, x: this._x, y: this._y });
      }
    } else if (dragObject.type === 'NodeData') {
      this.events.emit('startBoost', { meta: dragObject.data });
    }

    if (instrumented) {
      this._boundMove = (ev) => this._handleMove(ev);
      this._boundUp = (ev) => this._handleUp(ev);
      this._boundKey = (ev) => this._handleKey(ev);
      document.addEventListener('mousemove', this._boundMove);
      document.addEventListener('mouseup', this._boundUp);
      document.addEventListener('keydown', this._boundKey);
    }
  }

  private _inferMode(dragObject: IPublicTypeDragObject<TNode>): Mode {
    if (dragObject.type === 'Node') return 'move';
    if (dragObject.type === 'NodeData') return 'boost';
    return 'any';
  }

  private _handleMove(e: MouseEvent): void {
    if (this._mode === 'idle') return;

    // Update copy state if the modifier changed mid-drag.
    const newCopy = e.altKey || e.ctrlKey;
    if (newCopy !== this._copy) this._copy = newCopy;

    // Shake gate: ignore synthetic (0,0) events and sub-threshold moves.
    if (!this._shaken) {
      if (isInvalidPoint(e.clientX, e.clientY)) return;
      const dx = e.clientX - this._startX;
      const dy = e.clientY - this._startY;
      if (dx * dx + dy * dy < SHAKE_DISTANCE_SQ) return;
      this._shaken = true;
      // First real move: emit the ali-style `dragstart`.
      this.events.emit('dragstart', {
        dragObject: this._dragObject!,
        copy: this._copy,
      });
    }

    this._x = e.clientX;
    this._y = e.clientY;

    // Sensor dispatch: pick the active sensor via `chooseSensor`
    // and ask it for a `Location`. `chooseSensor` encapsulates
    // the ali-faithful `lastSensor` fallback (see method doc).
    if (this._dragObject) {
      this.chooseSensor(e);
      if (this._activeSensor) {
        const fixed = this._activeSensor.fixEvent(e);
        const loc = this._activeSensor.locate(fixed);
        this._dropTarget = this._locationToDropTarget(loc);
      }
    }

    this.events.emit('drag', {
      dragObject: this._dragObject!,
      copy: this._copy,
      x: this._x,
      y: this._y,
    });
    this.events.emit('move', {
      x: this._x,
      y: this._y,
      dropTarget: this._dropTarget,
    });
  }

  private _locationToDropTarget(loc: ReturnType<IPublicTypeSensor<TNode>['locate']>): DropTarget | null {
    if (!loc) return null;
    if (loc.detail.type === 'Self') {
      return { parentId: loc.target?.id ?? null, index: 0, placement: 'inside' };
    }
    // 'Children'
    const detail = loc.detail;
    return {
      parentId: loc.target?.id ?? null,
      index: detail.index,
      placement: (detail.near?.pos ?? 'before') as 'before' | 'after',
    };
  }

  private _handleUp(_e: MouseEvent): void {
    if (this._mode === 'idle') return;
    this._endGesture(false);
  }

  private _handleKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this._mode !== 'idle') {
      this._endGesture(true);
    }
  }

  private _endGesture(cancelled: boolean): void {
    const obj = this._dragObject;
    if (!obj) return;

    this.events.emit('dragend', { dragObject: obj, copy: this._copy, cancelled });

    if (this._mode === 'boost' && obj.type === 'NodeData') {
      if (cancelled) {
        this.events.emit('cancelBoost', { meta: obj.data });
      } else {
        this.events.emit('dropBoost', {
          meta: obj.data,
          target: this._dropTarget ?? { parentId: null, index: 0, placement: 'inside' },
        });
      }
    } else if (obj.type === 'Node' && obj.nodes.length > 0) {
      const nodeId = obj.nodes[0]?.id;
      if (nodeId !== undefined) {
        if (cancelled) {
          this.events.emit('cancel', { nodeId });
        } else {
          this.events.emit('drop', {
            nodeId,
            target: this._dropTarget ?? { parentId: null, index: 0, placement: 'inside' },
          });
        }
      }
    }

    this._reset();
  }

  private _teardown(): void {
    if (!this._instrumented) return;
    if (this._boundMove) document.removeEventListener('mousemove', this._boundMove);
    if (this._boundUp) document.removeEventListener('mouseup', this._boundUp);
    if (this._boundKey) document.removeEventListener('keydown', this._boundKey);
    this._boundMove = null;
    this._boundUp = null;
    this._boundKey = null;
    this._instrumented = false;
  }

  private _reset(): void {
    this._teardown();
    this._mode = 'idle';
    this._dragObject = null;
    this._copy = false;
    this._shaken = false;
    this._dropTarget = null;
    this._safeDeactivate(this._activeSensor);
    this._activeSensor = null;
    // Phase C.AD: clear the lastSensor memory on every reset
    // (drop / cancel / commit). The next gesture starts fresh.
    this._lastSensor = null;
  }
}
