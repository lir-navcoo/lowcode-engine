/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/insertion
 *
 * Phase D.I7b.1c: real port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/bem-tools/insertion.tsx`
 * (171 LoC ali → ~150 LoC slim). The `<InsertionView>` class
 * reads `host.currentDocument.dropLocation` (a slim
 * `IDropLocation` set by the `BuiltinSimulatorHost` on every
 * `handleMove`, D.I7b.1b) and renders a drop line:
 *   - **`cover`** — a rect over the target (ali's `coverRect`).
 *   - **`before` / `after`** — a vertical line on the left/right
 *     of the `near` sibling when the container is horizontal, or
 *     a horizontal line above/below when the container is
 *     vertical. Ali-faithful axis detection via `isVertical` (the
 *     Phase C.Z helper).
 *
 * Slim translations applied:
 *   - `@observer` decorator → `observerHOC` (D.I2)
 *   - `(loc.detail as any)?.valid === false` → structural check
 *     on the slim typed surface (no `as any`)
 *   - `loc.target?.componentMeta?.advanced.isAbsoluteLayoutContainer`
 *     → `loc.target.getComponentMeta()?.advanced?.isAbsoluteLayoutContainer`
 *     (typed via Phase E.5 + E.6 auto-wire)
 *   - Ali's `processChildrenDetail` + `processDetail` helpers →
 *     inline math (the slim `IDropLocation` is simpler than ali's
 *     discriminated union, so a single expression computes the
 *     rect)
 *   - `host.viewport.scale / scrollX / scrollY` → slim Viewport
 *     Observables (Phase C.Y)
 *
 * Returns `null` when:
 *   - `host.currentDocument.dropLocation` is `null` (no drop in
 *     progress)
 *   - `loc.target` is an absolute-layout container (ali-faithful:
 *     the absolute-positioned children don't get a drop line)
 *   - the target has no rect in the canvas (defensive — the slim
 *     `getNodeRect` returns `null` if the node isn't rendered)
 */
import * as React from 'react';
import { observerHOC } from '../../observer-hoc';
import { isVertical } from '../../locate';
import type { BuiltinSimulatorHost } from '../host';

export interface InsertionViewProps {
  host: BuiltinSimulatorHost;
}

class InsertionViewRaw extends React.Component<InsertionViewProps> {
  override render(): React.ReactNode {
    const { host } = this.props;
    const loc = host.currentDocument?.dropLocation ?? null;
    if (!loc) return null;

    // Absolute-layout containers don't get a drop line (ali-faithful).
    if (loc.target.getComponentMeta()?.advanced?.isAbsoluteLayoutContainer) {
      return null;
    }

    const { scale, scrollX, scrollY } = host.viewport;

    // Compute the rect of the target container. Multi-instance union
    // is handled by `host.getNodeRect` (Phase C.AC).
    const targetRect = host.getNodeRect(loc.target.id);
    if (!targetRect) return null;

    const near = loc.detail.near;
    if (loc.detail.index === null || !near) {
      // 'cover' / 'inside' / no-near: render a rect over the target.
      const x = (targetRect.left + scrollX) * scale;
      const y = (targetRect.top + scrollY) * scale;
      const w = targetRect.width * scale;
      const h = targetRect.height * scale;
      return (
        <div
          data-testid="insertion-cover"
          className={`lc-insertion cover${loc.detail.valid === false ? ' invalid' : ''}`}
          style={{ transform: `translate3d(${x}px, ${y}px, 0)`, width: w, height: h }}
        />
      );
    }

    // 'before' | 'after' with a near node. The line is on the
    // near node's edge; the axis depends on the near node's shape
    // (vertical / horizontal). Ali-faithful: use `isVertical` of
    // the near node's rect.
    const nearRect = host.getNodeRect(near.node.id);
    if (!nearRect) return null;
    const vertical = isVertical({
      left: nearRect.left,
      top: nearRect.top,
      width: nearRect.width,
      height: nearRect.height,
      right: nearRect.right,
      bottom: nearRect.bottom,
      x: nearRect.left,
      y: nearRect.top,
      toJSON: () => nearRect.toJSON(),
    } as DOMRect);
    let x: number;
    let y: number;
    let w: number | undefined;
    let h: number | undefined;
    if (vertical) {
      // Vertical line: x on the left/right of the near node, height
      // spans the near node.
      x = ((near.pos === 'before' ? nearRect.left : nearRect.right) + scrollX) * scale;
      y = (nearRect.top + scrollY) * scale;
      h = nearRect.height * scale;
    } else {
      // Horizontal line: y on the top/bottom of the near node,
      // width spans the near node.
      x = (nearRect.left + scrollX) * scale;
      y = ((near.pos === 'before' ? nearRect.top : nearRect.bottom) + scrollY) * scale;
      w = nearRect.width * scale;
    }
    return (
      <div
        data-testid="insertion-line"
        className={`lc-insertion ${vertical ? 'vertical' : 'horizontal'}${loc.detail.valid === false ? ' invalid' : ''}`}
        style={{
          transform: `translate3d(${x}px, ${y}px, 0)`,
          ...(w !== undefined ? { width: w } : {}),
          ...(h !== undefined ? { height: h } : {}),
        }}
      />
    );
  }
}

export const InsertionView = observerHOC(InsertionViewRaw);
InsertionView.displayName = 'InsertionView';
