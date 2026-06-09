/**
 * @monbolc/lowcode-designer — designer/drag-ghost
 * Ali-mirror Phase D.I8: the on-screen ghost that follows the cursor
 * during a drag.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/designer/drag-ghost/index.tsx`
 * (105 LoC ali → ~85 LoC slim). The `<DragGhost designer={...} />`
 * component subscribes to `dragon.events` and renders a positioned
 * `<div className="lc-ghost-group">` with the dragged node's title.
 *
 * Slim translations applied:
 *   - `@observer` + `@obx.ref` decorators → wrapped with `observerHOC`
 *     (D.I2) + the slim `useState`-backed local state pattern
 *   - `dragon.onDragstart` / `onDrag` / `onDragend` (ali-faithful
 *     convenience methods) → slim: `dragon.events.on('start' | 'move' | 'drop' | 'cancel', ...)`
 *   - `isSimulatorHost` from `../../simulator` → slim: structural check
 *     on the sensor (`sensor.getDropContainer` is a function)
 *   - `<Title>` from `@alilc/lowcode-editor-core` → slim `<Title>` (D.I6)
 *   - `designer.getComponentMeta(name).title` → slim: structural cast
 *     to access `.title` (the slim ComponentMeta shape is unknown;
 *     a Phase D-2 widening will provide the real surface)
 */
import * as React from 'react';
import { observerHOC } from '../../observer-hoc';
import { Title } from '../../components/title';

export interface DragGhostProps {
  designer: {
    dragon: { events: { on: (e: string, fn: (...a: unknown[]) => void) => () => void; off: (e: string, fn: (...a: unknown[]) => void) => void } };
    getComponentMeta(name: string): { title?: unknown };
  };
}

interface DragState {
  titles: (string | { type: string; value?: unknown } | React.ReactElement)[] | null;
  x: number;
  y: number;
  isAbsoluteLayoutContainer: boolean;
}

/**
 * Slim port of ali's `DragGhost` (105-LoC class). Ali-faithful
 * surface: 4 event subscriptions + 1 renderGhostGroup + 1 render.
 * The slim port uses local state (set via `dragon.events` callbacks)
 * instead of `@obx.ref` fields; the `observerHOC` wrap makes the
 * JSX render subscribe to the state changes.
 */
class DragGhostRaw extends React.Component<DragGhostProps, DragState> {
  private dispose: Array<() => void> = [];
  private readonly dragon = this.props.designer.dragon;

  constructor(props: DragGhostProps) {
    super(props);
    this.state = { titles: null, x: 0, y: 0, isAbsoluteLayoutContainer: false };
    this.dispose = [
      this.dragon.events.on('start', (e) => {
        const ev = e as { originalEvent?: { type?: string }; dragObject: { nodes?: Array<{ title?: unknown }>; data?: unknown }; globalX?: number; globalY?: number };
        if (ev.originalEvent?.type?.slice(0, 4) === 'drag') return;
        this.setState({
          titles: this.getTitles(ev.dragObject as never),
          x: ev.globalX ?? 0,
          y: ev.globalY ?? 0,
        });
      }),
      this.dragon.events.on('move', (e) => {
        const ev = e as { globalX?: number; globalY?: number; sensor?: { getDropContainer?: (e: unknown) => { container?: { componentMeta?: { advanced?: { isAbsoluteLayoutContainer?: boolean } } } } | null } };
        this.setState({ x: ev.globalX ?? 0, y: ev.globalY ?? 0 });
        // Ali-faithful: detect "absolute layout container" so the ghost
        // doesn't render when the drop target is absolute-positioned.
        const container = ev.sensor?.getDropContainer?.(ev);
        if (container?.container?.componentMeta?.advanced?.isAbsoluteLayoutContainer) {
          this.setState({ isAbsoluteLayoutContainer: true });
          return;
        }
        this.setState({ isAbsoluteLayoutContainer: false });
      }),
      this.dragon.events.on('drop', () => { this.setState({ titles: null, x: 0, y: 0 }); }),
      this.dragon.events.on('cancel', () => { this.setState({ titles: null, x: 0, y: 0 }); }),
    ];
  }

  override componentWillUnmount(): void {
    for (const off of this.dispose) off();
  }

  /**
   * Ali-faithful `getTitles`: returns the dragged node's titles
   * (`dragObject.nodes.map(n => n.title)`) for NodeData drags, or
   * the component meta's title for ComponentData drags.
   */
  getTitles(dragObject: { type?: string; nodes?: Array<{ title?: unknown }>; data?: unknown }): (string | { type: string; value?: unknown } | React.ReactElement)[] {
    if (dragObject.type === 'NodeData' && dragObject.nodes) {
      return dragObject.nodes.map((n) => (typeof n.title === 'string' ? n.title : ''));
    }
    const dataArr = Array.isArray(dragObject.data) ? (dragObject.data as Array<{ componentName: string }>) : [dragObject.data as { componentName: string }];
    return dataArr.map((item) => {
      const meta = this.props.designer.getComponentMeta(item.componentName);
      return (meta.title as string) ?? item.componentName;
    });
  }

  renderGhostGroup(): React.ReactNode {
    const { titles } = this.state;
    if (!titles) return null;
    return titles.map((title, i) => (
      <div className="lc-ghost" key={i}>
        <Title title={title as never} />
      </div>
    ));
  }

  override render(): React.ReactNode {
    const { titles, x, y, isAbsoluteLayoutContainer } = this.state;
    if (!titles || titles.length === 0) return null;
    if (isAbsoluteLayoutContainer) return null;
    return (
      <div
        className="lc-ghost-group"
        style={{ left: x, top: y }}
      >
        {this.renderGhostGroup()}
      </div>
    );
  }
}

export const DragGhost = observerHOC(DragGhostRaw);
DragGhost.displayName = 'DragGhost';

export default DragGhost;
