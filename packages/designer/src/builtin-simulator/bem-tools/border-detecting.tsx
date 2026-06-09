/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/border-detecting
 * Ali-mirror Phase D.I6: the hover-time blue border overlay.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/bem-tools/border-detecting.tsx`
 * (159 LoC ali → ~200 LoC slim). The `<BorderDetecting host={host} />`
 * component renders a `BorderDetectingInstance` for the currently
 * detected (hovered) node. The slim port uses the D.I2 `observerHOC`
 * for the observable subscriptions (scale, scrollX, scrollY, current).
 */
import * as React from 'react';
import { Fragment, PureComponent } from 'react';
import { observerHOC } from '../../observer-hoc';
import { intl } from '../../utils/locale';
import { getClosestNode } from '../../utils/tree-walk';
import { Title } from '../../components/title';
import type { BuiltinSimulatorHost } from '../host';

export interface BorderDetectingInstanceProps {
  title: unknown;
  rect: DOMRect | null;
  scale: number;
  scrollX: number;
  scrollY: number;
  isLocked?: boolean;
}

/**
 * Slim port of ali's `BorderDetectingInstance` (PureComponent). Renders
 * a 1-line `<div class="lc-borders lc-borders-detecting">` with the
 * `Title` inside, sized to the rect. The slim port keeps PureComponent
 * (no observable reads inside this inner class — the observables are
 * all read on the parent and passed via props).
 */
export class BorderDetectingInstance extends PureComponent<BorderDetectingInstanceProps> {
  override render(): React.ReactNode {
    const { title, rect, scale, scrollX, scrollY, isLocked } = this.props;
    if (!rect) return null;
    const style: React.CSSProperties = {
      width: rect.width * scale,
      height: rect.height * scale,
      transform: `translate(${(scrollX + rect.left) * scale}px, ${(scrollY + rect.top) * scale}px)`,
    };
    return (
      <div className="lc-borders lc-borders-detecting" style={style}>
        <Title title={title} className="lc-borders-title" />
        {isLocked ? <Title title={intl('locked')} className="lc-borders-status" /> : null}
      </div>
    );
  }
}

export interface BorderDetectingProps {
  host: BuiltinSimulatorHost;
}

/**
 * The `<BorderDetecting>` React class. Ali-faithful port of ali's
 * 159-LoC class. The slim port:
 *   - Wraps with `observerHOC` for observable subscriptions
 *   - Uses `getClosestNode` from `@monbolc/lowcode-utils` (Phase B
 *     slim port) instead of the ali `getClosestNode` import
 *   - Reads `host.designer.detecting.current` and `host.currentDocument.selection`
 *     via the slim host (D.I6 slots)
 *   - `intl('locked')` uses the Phase D.I6 locale shim
 */
class BorderDetectingRaw extends React.Component<BorderDetectingProps> {
  // Ali-faithful `@computed get scale() / scrollX() / scrollY() / current()`:
  // plain getters. The observerHOC wrap subscribes to the observable
  // reads (scaleObs / scrollXObs / scrollYObs / etc. on the slim host).
  get scale(): number { return this.props.host.viewport.scale; }
  get scrollX(): number { return this.props.host.viewport.scrollX; }
  get scrollY(): number { return this.props.host.viewport.scrollY; }
  get current(): unknown {
    const { host } = this.props;
    const doc = host.currentDocument;
    if (!doc) return null;
    // Slim port: `DocumentModel` doesn't yet have a `selection` proxy.
    // Ali-faithful would be `selection.has(current.id)`; the slim port
    // returns null when there's no current hovered node (the bem-tool
    // renders null in this case anyway). Phase D.I7 can wire the real
    // selection proxy.
    const { current } = host.designer.detecting;
    if (!current) return null;
    if ((current as { document?: unknown }).document !== doc) return null;
    return current;
  }

  override render(): React.ReactNode {
    const { host } = this.props;
    const current = this.current as null | {
      componentMeta: { advanced?: { callbacks?: { onHoverHook?: (shell: unknown) => boolean } }; rootSelector?: string };
      title?: unknown;
      isLocked?: boolean;
      id: string;
      getId(): string;
      contains(other: unknown): boolean;
      document: { focusNode?: { contains(other: unknown): boolean } | null };
      internalToShellNode(): unknown;
    } | null;
    if (!current) return null;
    const canHoverHook = current.componentMeta?.advanced?.callbacks?.onHoverHook;
    const canHover = canHoverHook && typeof canHoverHook === 'function'
      ? canHoverHook(current.internalToShellNode())
      : true;
    if (!canHover) return null;
    if (host.viewport.scrolling) return null;
    if (host.liveEditing?.editing) return null;

    // rootNode: hover whole viewport
    const focusNode = current.document.focusNode;
    if (!focusNode) return null;
    if (!focusNode.contains(current)) return null;

    if (current.contains(focusNode)) {
      const bounds = host.viewport.bounds;
      return (
        <BorderDetectingInstance
          key="line-root"
          title={current.title}
          scale={this.scale}
          scrollX={host.viewport.scrollX}
          scrollY={host.viewport.scrollY}
          rect={new DOMRect(0, 0, bounds.width, bounds.height)}
        />
      );
    }

    // Locked ancestor: highlight the parent's locked region
    const lockedNode = getClosestNode(current, (n) => {
      const node = n as unknown as { parent?: { isLocked?: boolean } | null; isLocked?: boolean };
      return !!(current.isLocked ? node.parent?.isLocked : node.isLocked);
    });
    if (lockedNode && lockedNode.getId() !== current.getId()) {
      const instances = host.getComponentInstances(lockedNode as never);
      const inst = instances?.[0];
      if (!inst) return null;
      const rect = host.computeComponentInstanceRect(
        inst,
        current.componentMeta.rootSelector,
      );
      if (!rect) return null;
      return (
        <BorderDetectingInstance
          key="line-h"
          title={current.title}
          scale={this.scale}
          scrollX={this.scrollX}
          scrollY={this.scrollY}
          rect={rect}
          isLocked
        />
      );
    }

    // Normal case: 1 or more instances of the current node
    const instances = host.getComponentInstances(current as never);
    if (!instances || instances.length < 1) return null;
    if (instances.length === 1) {
      const rect = host.computeComponentInstanceRect(instances[0], current.componentMeta.rootSelector);
      if (!rect) return null;
      return (
        <BorderDetectingInstance
          key="line-h"
          title={current.title}
          scale={this.scale}
          scrollX={this.scrollX}
          scrollY={this.scrollY}
          rect={rect}
        />
      );
    }
    return (
      <Fragment>
        {instances.map((inst, i) => {
          const rect = host.computeComponentInstanceRect(inst, current.componentMeta.rootSelector);
          if (!rect) return null;
          return (
            <BorderDetectingInstance
              key={`line-h-${i}`}
              title={current.title}
              scale={this.scale}
              scrollX={this.scrollX}
              scrollY={this.scrollY}
              rect={rect}
            />
          );
        })}
      </Fragment>
    );
  }
}

export const BorderDetecting = observerHOC(BorderDetectingRaw);
BorderDetecting.displayName = 'BorderDetecting';
