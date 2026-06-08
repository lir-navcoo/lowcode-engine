/**
 * @monbolc/lowcode-types — drag-and-drop public type surface
 *
 * This file declares the *public* contract for the drag-and-drop
 * subsystem. Two layers:
 *
 *   1. **Data shapes** — `IPublicTypeDragObject`, `IPublicTypeLocateEvent`,
 *      `IPublicTypeLocation`. These flow between the host, the Dragon
 *      (in `@monbolc/lowcode-designer`), and the public Dragon wrapper
 *      (in `@monbolc/lowcode-shell`).
 *
 *   2. **Plugins / extension points** — `IPublicTypeSensor<TNode>` and
 *      `IPublicModelDragon<TNode, TLocateEvent>`. Plugin authors
 *      depend on these to add drop targets and to wire custom
 *      drag sources WITHOUT coupling to the internal `INode` type.
 *
 * Generic over `TNode` so the same interfaces work for the
 * public `IPublicTypeNodeSchema`, the internal `Node`, a custom
 * user-defined node shape, etc. Sapu ships two concrete bindings:
 *   - `IPublicModelDragon<IPublicTypeNodeSchema, IPublicTypeLocateEvent>` for hosts
 *   - `IPublicModelDragon<Node, IPublicTypeLocateEvent>`             for the engine core
 *
 * Inspired by `alibaba/lowcode-engine` v1.3.2
 * (`types/src/shell/model/dragon.ts` + `types/src/shell/type/drag-object.ts`),
 * slimmed to what's actually used by the sapu engine.
 */

// ---------- 1. Node-like bound ----------

/**
 * Minimum shape a `TNode` generic must satisfy. The Dragon only
 * needs `id` and `componentName`; the host / sensors can read more.
 *
 * `IPublicTypeNodeSchema` (declared in `index.ts`) is one such
 * concrete binding; the engine's internal `Node` (in
 * `@monbolc/lowcode-designer`) is another.
 */
export interface IPublicTypeNodeLike {
  readonly id: string;
  readonly componentName: string;
  /** Free-form; the engine does not interpret this. */
  readonly [key: string]: unknown;
}

// ---------- 2. Boost meta (palette → canvas payload) ----------

/**
 * Payload for a "boost" — a drag that hasn't started from an
 * existing node. The component is created from `componentName`
 * (+ optional `initialProps`) on a successful drop.
 */
export interface IPublicTypeBoostMeta {
  componentName: string;
  initialProps?: Record<string, import('./index').JSONValue>;
}

// ---------- 3. Drag object (the thing being dragged) ----------

/**
 * Discriminated union of what the user is dragging. Ali uses
 * three kinds; sapu keeps the same taxonomy for cross-compat:
 *
 * - `'Node'` — dragging existing nodes (move / copy within the canvas).
 * - `'NodeData'` — dragging a palette item (creates a new node on drop).
 * - `'Any'` — opaque drag (file drop, cross-window drop). Sensors
 *   that can't handle it should return `null` from `locate`.
 */
export type IPublicTypeDragObject<TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike> =
  | { readonly type: 'Node'; readonly nodes: readonly TNode[] }
  | { readonly type: 'NodeData'; readonly data: IPublicTypeBoostMeta }
  | { readonly type: 'Any'; readonly extra: unknown };

// ---------- 4. Locate event (what the dragon dispatches) ----------

/**
 * The event payload sent to sensors on every pointer move. Carries
 * both raw and canvas-local coordinates so sensors don't have to
 * normalize themselves.
 *
 * `globalX/Y` = viewport coordinates (raw `clientX/Y`).
 * `canvasX/Y` = canvas-local (subtracts the canvas's viewport offset).
 */
export interface IPublicTypeLocateEvent<TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike> {
  readonly globalX: number;
  readonly globalY: number;
  readonly canvasX: number;
  readonly canvasY: number;
  readonly clientX: number;
  readonly clientY: number;
  /** DOM element under the pointer (resolved via `elementFromPoint`). */
  readonly target: Element | null;
  /** The thing being dragged. */
  readonly dragObject: IPublicTypeDragObject<TNode>;
  /** The sensor that owns this event (set by `chooseSensor`). */
  readonly sensor?: IPublicTypeSensor<TNode>;
  /** The original DOM event (MouseEvent or DragEvent). */
  readonly originalEvent?: MouseEvent | DragEvent;
}

// ---------- 5. Location (what the sensor returns) ----------

/**
 * A drop position, relative to a target node.
 *
 * Two detail kinds:
 * - `'Self'`   — drop INTO the target as a child (e.g. clicking on
 *                an empty container). `index` is the child's index.
 * - `'Children'` — drop BETWEEN target's existing children. `index`
 *                is the position. `near` disambiguates "before/after"
 *                when the pointer is closest to a specific sibling.
 *                `edge` carries the rect used for inline/row axis
 *                detection (V = vertical flex/grid, H = horizontal).
 */
export type IPublicTypeLocation<TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike> = {
  readonly target: TNode | null;
  readonly detail:
    | {
        readonly type: 'Self';
      }
    | {
        readonly type: 'Children';
        readonly index: number;
        readonly near?: { readonly node: TNode; readonly pos: 'before' | 'after' };
        readonly edge?: {
          readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
          readonly align: 'H' | 'V';
        };
      };
};

// ---------- 6. Sensor (drop target provider) ----------

/**
 * A drop target provider. The BuiltinSimulatorHost ships as the
 * default sensor for the canvas; hosts can register their own
 * (e.g. an outline-pane sensor that drops "into the outline node"
 * or a Free-Layout plugin's grid sensor).
 *
 * `fixEvent` runs once per pointer event to normalize the
 * `MouseEvent` / `DragEvent` into a `LocateEvent`. `isEnter`
 * gates whether the sensor wants this event at all. `locate`
 * is the actual drop-target computation.
 */
export interface IPublicTypeSensor<TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike> {
  /** Unique sensor name (used by `removeSensor(name)`). */
  readonly name: string;
  /**
   * Ali-faithful: false when this sensor is temporarily unable
   * to respond (e.g. a panel is hidden). The Dragon's
   * `chooseSensor` skips `sensorAvailable: false` sensors when
   * picking the active one. Optional — sensors that don't
   * implement this default to "always available" (the slim
   * host's sensor, the outline-pane sensor, etc.). */
  readonly sensorAvailable?: boolean;
  /** Whether the pointer is over this sensor's territory. */
  isEnter(e: IPublicTypeLocateEvent<TNode>): boolean;
  /** Normalize a raw DOM event into a `LocateEvent`. */
  fixEvent(e: MouseEvent | DragEvent): IPublicTypeLocateEvent<TNode>;
  /**
   * Ali-faithful: called by the Dragon when this sensor was
   * the active sensor and a different sensor just took over
   * (or the gesture ended). Default no-op via the Dragon's
   * `_safeDeactivate`. Sensors that hold external state
   * (highlight rings, hover indicators) override this to clean
   * up. Optional — slim sensors without state don't need to
   * implement this. */
  deactiveSensor?(): void;
  /** Compute the drop location under the pointer, or `null` if no valid target. */
  locate(e: IPublicTypeLocateEvent<TNode>): IPublicTypeLocation<TNode> | null;
}

// ---------- 7. Public Dragon (host-facing API) ----------

/**
 * The host-facing Dragon facade. The engine exposes this on
 * `engine.dragon`; plugins receive it via `IPluginContext.dragon`.
 *
 * Generic over `<TNode, TLocateEvent>` so plugin authors can use
 * their own node shape (e.g. a typed subset) without coupling to
 * the internal `Node` class.
 */
export interface IPublicModelDragon<
  TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike,
  TLocateEvent extends IPublicTypeLocateEvent<TNode> = IPublicTypeLocateEvent<TNode>,
> {
  /** Is any drag (move or boost) currently in progress? */
  readonly dragging: boolean;
  /** Is a boost (palette → canvas) currently in progress? */
  readonly boosting: boolean;
  /** All registered sensors (read-only snapshot). */
  readonly sensors: readonly IPublicTypeSensor<TNode>[];

  /**
   * Start a drag programmatically. The Dragon wires `mousemove` +
   * `mouseup` (or `dragover` + `drop` for native HTML5 DnD) on the
   * host's `document` until the gesture ends.
   *
   * `fromRglNode` is reserved for the RGL Free-Layout plugin; sapu
   * ships without RGL, so passing it is a no-op.
   */
  boost(dragObject: IPublicTypeDragObject<TNode>, e: MouseEvent, fromRglNode?: unknown): void;

  /**
   * Bind a DOM element as a drag source. The Dragon installs
   * `mousedown` on `shell`; when fired, the host's `boost` callback
   * converts the mouse event into a `DragObject` and the Dragon
   * takes over. Returns a disposer.
   */
  from(
    shell: HTMLElement,
    boost: (e: MouseEvent) => IPublicTypeDragObject<TNode> | null,
  ): () => void;

  /** Register a drop-target sensor. */
  addSensor(sensor: IPublicTypeSensor<TNode>): void;
  /** Unregister a sensor by name. */
  removeSensor(name: string): void;

  /** Subscribe to drag start (after the shake gate trips). */
  onDragstart(
    fn: (e: { readonly dragObject: IPublicTypeDragObject<TNode>; readonly copy: boolean }) => void,
  ): () => void;
  /** Subscribe to per-tick drag (after `start`, before `end`). */
  onDrag(
    fn: (e: {
      readonly dragObject: IPublicTypeDragObject<TNode>;
      readonly locateEvent: TLocateEvent;
      readonly copy: boolean;
    }) => void,
  ): () => void;
  /** Subscribe to drag end (drop or cancel). */
  onDragend(
    fn: (e: {
      readonly dragObject: IPublicTypeDragObject<TNode>;
      readonly copy: boolean;
      readonly cancelled: boolean;
    }) => void,
  ): () => void;

  /** Cancel any in-flight drag. (Useful for ESC handling.) */
  cancel(): void;
}
