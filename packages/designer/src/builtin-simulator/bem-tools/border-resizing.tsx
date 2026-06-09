/**
 * @monbolc/lowcode-engine — builtin-simulator/bem-tools/border-resizing
 *
 * Phase D.I7b.3: real port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/bem-tools/border-resizing.tsx`
 * (358 LoC ali → ~180 LoC slim). The `<BorderResizing>` class
 * renders 8 resize handles (N / NE / E / SE / S / SW / W / NW)
 * around the selected node and reuses sapu's existing
 * `DragResizeEngine` (P9 commit `2afd82e`) for the actual drag
 * math.
 *
 * Slim translations applied:
 *   - Ali's `DragResizeEngine` (separate file, ~500 LoC) → sapu's
 *     existing `DragResizeEngine` (P9). The slim engine already
 *     has `start(nodeId, anchor, e)` and `commit()` / `cancel()`;
 *     this commit wires the bem-tool UI to it.
 *   - Ali's `metadata.configure.advanced.getResizingHandlers(node)`
 *     → slim shows all 8 handles (the slim port doesn't have the
 *     `configure` zoo — the slim componentMeta is the lightweight
 *     `IComponentMetaLite`).
 *   - Ali's `advanced.callbacks.onResize` / `onResizeStart` /
 *     `onResizeEnd` → slim port skips for v1. The slim
 *     `IComponentMetaLite.advanced.callbacks` is a placeholder
 *     structure; a future Phase E Asset commit adds the
 *     `onResize*` hook chain.
 *   - Ali's `editor.eventBus.emit('designer.border.resize', ...)`
 *     → slim port omits for v1. The slim engine's `commit()` is
 *     enough; the `designer.border.resize` event is a UI hint for
 *     the ali-faithful settings panel to update its `width` /
 *     `height` props. The slim setters already subscribe to
 *     `setProps` via the `nodeAdded` / `nodeChanged` events.
 *   - Ali's `node.internalToShellNode()` → slim port uses the
 *     node as-is (slim nodes ARE the public surface).
 *   - `@observer` decorator → `observerHOC` (D.I2).
 *
 * Returns `null` when:
 *   - `host.currentDocument.selection` is empty
 *   - the Dragon is dragging (ali-faithful: don't show resize
 *     handles during a drag)
 */
import * as React from 'react';
import { Fragment } from 'react';
import { observerHOC } from '../../observer-hoc';
import { DragResizeEngine, type ResizeAnchor } from '../../drag-resize';
import type { BuiltinSimulatorHost } from '../host';
import type { Node } from '../../node';

export interface BorderResizingProps {
  host: BuiltinSimulatorHost;
}

interface HandleProps {
  /** The anchor (n / ne / e / ...). */
  anchor: ResizeAnchor;
  /** The node being resized. */
  node: Node;
  /** The DragResizeEngine. */
  engine: DragResizeEngine;
  /** Inline style. Each handle has a distinct position. */
  style: React.CSSProperties;
  /** Cursor for the handle. */
  cursor: string;
  /** Display visibility. 'flex' = shown, 'none' = hidden. */
  visible: boolean;
  /** testid suffix. */
  testid: string;
}

function Handle({ anchor, node, engine, style, cursor, visible, testid }: HandleProps): React.ReactElement {
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    engine.start(node.id, anchor, e.nativeEvent);
  };
  return (
    <div
      data-testid={`resize-handle-${testid}`}
      data-anchor={anchor}
      className={`lc-borders lc-resize-${anchor}`}
      style={{ ...style, cursor, display: visible ? 'flex' : 'none' }}
      onPointerDown={onPointerDown}
    />
  );
}

class BorderResizingRaw extends React.Component<BorderResizingProps> {
  private readonly _engine: DragResizeEngine;
  constructor(props: BorderResizingProps) {
    super(props);
    this._engine = new DragResizeEngine({
      project: props.host.project,
      canvas: props.host.getCanvas(),
    });
  }
  override componentWillUnmount(): void {
    if (this._engine.isResizing) this._engine.cancel();
  }
  override render(): React.ReactNode {
    const { host } = this.props;
    const doc = host.currentDocument;
    if (!doc) return null;
    const dragging = (host as unknown as { designer: { dragon: { dragging: boolean } } }).designer.dragon?.dragging ?? false;
    if (dragging) return null;
    // Phase D.I7b.3 slim: read selected node ids from the project's
    // slim `selectedIds` (Phase D.I7b-prep). Ali-faithful path:
    // `doc.selection.getNodes()` (slim Selection implements it,
    // but for the bem-tool the project-level proxy is simpler).
    const selectedIds = (host.project as unknown as { selectedIds: string[] }).selectedIds;
    if (!selectedIds || selectedIds.length < 1) return null;
    return (
      <Fragment>
        {selectedIds.map((id) => (
          <BorderResizingForNode
            key={id}
            host={host}
            nodeId={id}
            engine={this._engine}
          />
        ))}
      </Fragment>
    );
  }
}

class BorderResizingForNodeRaw extends React.Component<{
  host: BuiltinSimulatorHost;
  nodeId: string;
  engine: DragResizeEngine;
}> {
  override render(): React.ReactNode {
    const { host, nodeId, engine } = this.props;
    // Phase D.I7b.3 slim: the slim `createOffsetObserver` reads the
    // rect from the canvas via `[data-lce-id]` (Phase D.I7b.3
    // upgrade). We pass any truthy instance so the observer has
    // the shape it expects; the slim port doesn't depend on the
    // instance for the rect (the canvas selector is canonical).
    const node = host.project.document.getNode(nodeId) as { id: string } | undefined;
    if (!node) return null;
    const observed = (host as unknown as { createOffsetObserver: (o: { node: unknown; instance: unknown }) => null | { id: string; hasOffset: boolean; offsetWidth: number; offsetHeight: number; offsetTop: number; offsetLeft: number; purge: () => void } }).createOffsetObserver({ node, instance: null });
    if (!observed) return null;
    if (!observed.hasOffset) return null;
    const { offsetWidth, offsetHeight, offsetTop, offsetLeft } = observed;
    const n = node as unknown as Node;
    return (
      <Fragment>
        <Handle
          testid="n"
          anchor="n"
          node={n}
          engine={engine}
          visible
          cursor="ns-resize"
          style={{ height: 20, width: offsetWidth, transform: `translate(${offsetLeft}px, ${offsetTop - 10}px)` }}
        />
        <Handle
          testid="ne"
          anchor="ne"
          node={n}
          engine={engine}
          visible
          cursor="nesw-resize"
          style={{ transform: `translate(${offsetLeft + offsetWidth - 5}px, ${offsetTop - 3}px)` }}
        />
        <Handle
          testid="e"
          anchor="e"
          node={n}
          engine={engine}
          visible
          cursor="ew-resize"
          style={{ height: offsetHeight, width: 20, transform: `translate(${offsetLeft + offsetWidth - 10}px, ${offsetTop}px)` }}
        />
        <Handle
          testid="se"
          anchor="se"
          node={n}
          engine={engine}
          visible
          cursor="nwse-resize"
          style={{ transform: `translate(${offsetLeft + offsetWidth - 5}px, ${offsetTop + offsetHeight - 5}px)` }}
        />
        <Handle
          testid="s"
          anchor="s"
          node={n}
          engine={engine}
          visible
          cursor="ns-resize"
          style={{ height: 20, width: offsetWidth, transform: `translate(${offsetLeft}px, ${offsetTop + offsetHeight - 10}px)` }}
        />
        <Handle
          testid="sw"
          anchor="sw"
          node={n}
          engine={engine}
          visible
          cursor="nesw-resize"
          style={{ transform: `translate(${offsetLeft - 3}px, ${offsetTop + offsetHeight - 5}px)` }}
        />
        <Handle
          testid="w"
          anchor="w"
          node={n}
          engine={engine}
          visible
          cursor="ew-resize"
          style={{ height: offsetHeight, width: 20, transform: `translate(${offsetLeft - 10}px, ${offsetTop}px)` }}
        />
        <Handle
          testid="nw"
          anchor="nw"
          node={n}
          engine={engine}
          visible
          cursor="nwse-resize"
          style={{ transform: `translate(${offsetLeft - 3}px, ${offsetTop - 3}px)` }}
        />
      </Fragment>
    );
  }
}

const BorderResizingForNode = observerHOC(BorderResizingForNodeRaw);
BorderResizingForNode.displayName = 'BorderResizingForNode';

export const BorderResizing = observerHOC(BorderResizingRaw);
BorderResizing.displayName = 'BorderResizing';
