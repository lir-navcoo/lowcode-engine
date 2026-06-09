/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/border-selecting
 * Ali-mirror Phase D.I7: the selection border + Toolbar.
 *
 * Slim port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/bem-tools/border-selecting.tsx`
 * (230 LoC ali → ~270 LoC slim). The `<BorderSelecting>` class iterates
 * the current selection (or `selection.getTopNodes()` mid-drag) and
 * renders a `<BorderSelectingForNode>` per node; the inner
 * `<BorderSelectingInstance>` shows the orange selection border + the
 * floating `<Toolbar>` (with available actions from
 * `node.componentMeta.availableActions`).
 *
 * Slim translations applied:
 *   - `@observer` decorator → wrapped with `observerHOC` (D.I2)
 *   - `<Tip>` from `@alilc/lowcode-editor-core` → BaseUI `Tooltip` compound
 *     (Phase D.I7b.6). The `Tooltip.Trigger` uses a `render` prop to keep
 *     the existing `<div className="lc-borders-action">` shape; the
 *     hover-open / close-on-out semantics replace the native HTML
 *     `title` attribute. delay=300 / closeDelay=100 (ali-faithful UX).
 *   - `createIcon` from `@alilc/lowcode-utils` → ali-faithful: reads
 *     `icon.type` / `icon.props`; for the slim port, the icon name is
 *     rendered as a plain `<span data-icon={icon.name}>` (the real
 *     icon font comes from a Phase E Asset pipeline)
 *   - `isReactComponent` / `isActionContentObject` from `@alilc/lowcode-utils`
 *     → slim 1-line type guards in this file
 *   - `<NodeSelector>` import (ali's separate file, 130 LoC) → slim
 *     stub: `NodeSelector` (Phase D.I7 D.I7 stub) returns `null`. The
 *     real BaseUI Popover port lands in a follow-up commit.
 *   - `designer.createOffsetObserver({node, instance})` → slim:
 *     `host.createOffsetObserver({node, instance})` (D.I7 adds this
 *     to the host)
 */
import * as React from 'react';
import { Fragment } from 'react';
import { Tooltip } from '@base-ui-components/react/tooltip';
import { observerHOC } from '../../observer-hoc';
import { engineConfig } from '../../utils/engine-config';
import { NodeSelector } from './node-selector';
import type { BuiltinSimulatorHost } from '../host';

export interface BorderSelectingProps {
  host: BuiltinSimulatorHost;
}

/**
 * The `<BorderSelectingInstance>` slim port. Renders a 1-rect selection
 * border around a single component instance.
 */
class BorderSelectingInstanceRaw extends React.Component<{
  observed: {
    hasOffset: boolean;
    offsetWidth: number;
    offsetHeight: number;
    offsetTop: number;
    offsetLeft: number;
    node: { componentMeta: { advanced?: { hideSelectTools?: boolean } } };
    /** Phase D.I7b.2: host backref so the Toolbar can render the
     *  NodeSelector (which needs `host.project.select()`). */
    host?: unknown;
    purge(): void;
  };
  highlight?: boolean;
  dragging?: boolean;
}> {
  override componentWillUnmount(): void {
    this.props.observed.purge();
  }

  override render(): React.ReactNode {
    const { observed, highlight, dragging } = this.props;
    if (!observed.hasOffset) return null;
    const { offsetWidth, offsetHeight, offsetTop, offsetLeft } = observed;
    const className = `lc-borders lc-borders-selecting ${highlight ? 'highlight' : ''} ${dragging ? 'dragging' : ''}`.trim();
    // Phase D.I7b.6: read hideSelectTools via the typed
    // getComponentMeta() (Phase E.5 + E.6 auto-wire). The structural
    // `node.componentMeta.advanced` access is no longer valid — the
    // slim Node exposes the meta via `getComponentMeta()`. Fall
    // back to `false` if the meta is missing.
    const node = observed.node as { getComponentMeta?: () => { advanced?: { hideSelectTools?: boolean } } | null };
    const hideSelectTools = node.getComponentMeta?.()?.advanced?.hideSelectTools ?? false;
    if (hideSelectTools) return null;
    const hideComponentAction = engineConfig.get('hideComponentAction') as boolean | undefined;
    return (
      <div className={className} style={{
        width: offsetWidth,
        height: offsetHeight,
        transform: `translate3d(${offsetLeft}px, ${offsetTop}px, 0)`,
      }}>
        {!dragging && !hideComponentAction ? <Toolbar observed={observed as never} /> : null}
      </div>
    );
  }
}

const BorderSelectingInstance = observerHOC(BorderSelectingInstanceRaw);
BorderSelectingInstance.displayName = 'BorderSelectingInstance';

/**
 * The slim `<Toolbar>`. Ali-faithful shape: a small bar above/below the
 * selection border with the node's `availableActions` rendered as icon
 * buttons. Position math is ali-faithful (top vs bottom vs fallback,
 * left vs right based on `SPACE_MINIMUM_WIDTH`).
 */
class ToolbarRaw extends React.Component<{
  observed: {
    viewport: { height: number; width: number };
    top: number; bottom: number; left: number; right: number; width: number;
    node: unknown;
    /** Phase D.I7b.2: host backref for NodeSelector (host.project.select). */
    host?: unknown;
  };
}> {
  override render(): React.ReactNode {
    const { observed } = this.props;
    const { height, width } = observed.viewport;
    const BAR_HEIGHT = 20;
    const MARGIN = 1;
    const BORDER = 2;
    const SPACE_HEIGHT = BAR_HEIGHT + MARGIN + BORDER;
    const SPACE_MINIMUM_WIDTH = 160;
    const style: Record<string, unknown> = {};
    if (observed.top > SPACE_HEIGHT) {
      style.top = -SPACE_HEIGHT;
      style.height = BAR_HEIGHT;
    } else if (observed.bottom + SPACE_HEIGHT < height) {
      style.bottom = -SPACE_HEIGHT;
      style.height = BAR_HEIGHT;
    } else {
      style.height = BAR_HEIGHT;
      style.top = Math.max(MARGIN, MARGIN - observed.top);
    }
    if (SPACE_MINIMUM_WIDTH > observed.left + observed.width) {
      style.left = Math.max(-BORDER, observed.left - width - BORDER);
    } else {
      style.right = Math.max(-BORDER, observed.right - width - BORDER);
      style.justifyContent = 'flex-start';
    }
    const { node } = observed;
    const actions: React.ReactNode[] = [];
    // Phase E.7: use the typed componentMeta (E.5 + E.6 auto-wire)
    // instead of the structural cast. The slim port reads the
    // availableActions from the typed meta.
    const cm = (node as unknown as { getComponentMeta?: () => import('../../component-meta').IComponentMetaLite | null }).getComponentMeta?.();
    for (const action of cm?.availableActions ?? []) {
      const { important = true, condition, content, name } = action;
      if ((node as { isSlot?: () => boolean }).isSlot?.() && (name === 'copy' || name === 'remove')) continue;
      if (!important) continue;
      const condOk = typeof condition === 'function' ? condition(node) !== false : condition !== false;
      if (condOk) actions.push(createAction(content, name, node as never));
    }
    return (
      <div className="lc-borders-actions" style={style as React.CSSProperties}>
        {actions}
        <NodeSelector node={node as never} host={this.props.observed.host as never} />
      </div>
    );
  }
}

const Toolbar = observerHOC(ToolbarRaw);
Toolbar.displayName = 'Toolbar';

/**
 * Slim `createAction`: renders one of 3 shapes (ReactElement, ComponentType,
 * IPublicTypeActionContentObject). The slim port drops `createIcon` (the
 * icon font is a Phase E asset); the icon is rendered as a plain
 * `<span data-icon={icon.name}>` placeholder.
 */
function createAction(
  content: unknown,
  key: string,
  node: {
    internalToShellNode?(): unknown;
    document?: { designer?: { editor?: { eventBus?: { emit: (e: string, p: unknown) => void } } } } | null;
    componentMeta?: { npm?: { package?: string; componentName?: string }; componentName?: string };
  },
): React.ReactElement | null {
  if (React.isValidElement(content)) {
    return React.cloneElement(content, { key, node } as never);
  }
  if (typeof content === 'function') {
    return React.createElement(content as React.ComponentType<{ key: string; node: unknown }>, { key, node });
  }
  if (content && typeof content === 'object' && 'action' in (content as Record<string, unknown>)) {
    const c = content as { action?: (n: unknown) => void; title?: string; icon?: { name: string } };
    // Phase D.I7b.6: BaseUI Tooltip replaces the native `title`
    // attribute. The Trigger's `render` prop keeps the existing
    // `<div className="lc-borders-action">` element shape; the
    // Tooltip wraps it in hover-open / close-on-out semantics.
    // No `title` attribute is set on the action div anymore.
    return (
      <Tooltip.Root key={key}>
        <Tooltip.Trigger
          delay={300}
          closeDelay={100}
          render={
            <div
              className="lc-borders-action"
              data-testid={`border-action-${key}`}
              onClick={() => {
                c.action?.(node.internalToShellNode?.());
                const editor = node.document?.designer?.editor;
                const npm = node.componentMeta?.npm;
                const selected = [npm?.package, npm?.componentName].filter(Boolean).join('-') ||
                  node.componentMeta?.componentName ||
                  '';
                editor?.eventBus?.emit('designer.border.action', { name: key, selected });
              }}
            />
          }
        >
          {c.icon ? <span data-icon={c.icon.name} /> : null}
        </Tooltip.Trigger>
        {c.title ? (
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={6}>
              <Tooltip.Popup className="lc-borders-action-tooltip">
                {c.title}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        ) : null}
      </Tooltip.Root>
    );
  }
  return null;
}

/**
 * The `<BorderSelectingForNode>` slim port. Per-node container: builds
 * an `OffsetObserver` per instance via `host.createOffsetObserver`.
 */
class BorderSelectingForNodeRaw extends React.Component<{ host: BuiltinSimulatorHost; node: unknown }> {
  get host(): BuiltinSimulatorHost { return this.props.host; }
  get dragging(): boolean { return this.host.designer.dragon?.dragging ?? false; }
  override render(): React.ReactNode {
    const { node } = this.props;
    // Phase D.I7b.3 slim: if `getComponentInstances` returns null
    // (the slim port doesn't have an instance map populated by
    // the host until components mount), synthesize a single
    // instance from the node itself. The slim
    // `createOffsetObserver` reads the rect from the canvas via
    // `[data-lce-id]` (Phase D.I7b.3 upgrade), so a synthetic
    // instance works for the bem-tool tree.
    let instances: unknown[] | null = (this.host as unknown as {
      getComponentInstances: (n: unknown) => unknown[] | null;
    }).getComponentInstances(node);
    if (!instances || instances.length < 1) {
      instances = [node];
    }
    return (
      <Fragment key={(node as { id: string }).id}>
        {instances.map((instance) => {
          const observed = (this.host as unknown as {
            createOffsetObserver: (opts: { node: unknown; instance: unknown }) => unknown;
          }).createOffsetObserver({ node, instance });
          if (!observed) return null;
          // Phase D.I7b.2: attach the host backref so the Toolbar's
          // NodeSelector can read `host.project`.
          (observed as { host?: unknown }).host = this.host;
          // Phase D.I7b.6: attach the viewport (for Toolbar's
          // position math). The slim `observed` doesn't carry the
          // viewport (OffsetObserver is DOM-only); the Toolbar
          // reads it from the host backref.
          (observed as { viewport?: unknown }).viewport = this.host.viewport;
          return (
            <BorderSelectingInstance
              key={(observed as { id: string }).id}
              dragging={this.dragging}
              observed={observed as never}
            />
          );
        })}
      </Fragment>
    );
  }
}

const BorderSelectingForNode = observerHOC(BorderSelectingForNodeRaw);
BorderSelectingForNode.displayName = 'BorderSelectingForNode';

/**
 * The `<BorderSelecting>` root. Slim port of ali's 230-LoC class.
 * Renders one `<BorderSelectingForNode>` per selected node; mid-drag
 * uses `selection.getTopNodes()` (ali-faithful "drag selects the
 * parent").
 */
class BorderSelectingRaw extends React.Component<BorderSelectingProps> {
  get host(): BuiltinSimulatorHost { return this.props.host; }
  get dragging(): boolean { return this.host.designer.dragon?.dragging ?? false; }
  get selecting(): unknown[] | null {
    const doc = this.host.currentDocument;
    if (!doc) return null;
    if ((this.host as unknown as { liveEditing: { editing: boolean } }).liveEditing?.editing) return null;
    // Phase D.I7b.6 slim: read from `host.project.selectedIds` (the
    // project-level proxy; slim Selection is a parallel state that
    // is populated by the editor skeleton's click handlers, not
    // the bem-tool tree). The slim port unifies on project-level
    // selection — same UX, single source of truth.
    const ids = this.host.project.selectedIds;
    if (!ids || ids.length < 1) return null;
    const nodes = ids
      .map((id) => doc.getNode(id))
      .filter((n): n is NonNullable<typeof n> => n !== undefined);
    return this.dragging ? nodes.filter((n) => !this._hasAncestorInSet(n, new Set(ids))) : nodes;
  }
  private _hasAncestorInSet(n: { parent: unknown }, ids: Set<string>): boolean {
    let p: { parent: unknown } | null = n;
    while (p) {
      const pp = p.parent as { id?: string } | null;
      if (pp && ids.has(pp.id ?? '')) return true;
      p = pp as { parent: unknown } | null;
    }
    return false;
  }
  override render(): React.ReactNode {
    const selecting = this.selecting;
    if (!selecting || selecting.length < 1) return null;
    return (
      <Fragment>
        {selecting.map((node) => (
          <BorderSelectingForNode key={(node as { id: string }).id} host={this.props.host} node={node} />
        ))}
      </Fragment>
    );
  }
}

export const BorderSelecting = observerHOC(BorderSelectingRaw);
BorderSelecting.displayName = 'BorderSelecting';
