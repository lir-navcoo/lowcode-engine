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
 *   - `<Tip>` from `@alilc/lowcode-editor-core` → native `title` attribute
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
import { observerHOC } from '../../observer-hoc';
import { engineConfig } from '../../utils/engine-config';
import { NodeSelector } from './node-selector-stub';
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
    const { hideSelectTools } = observed.node.componentMeta.advanced ?? {};
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
    const cm = (node as { componentMeta?: { availableActions?: Array<{
      important?: boolean;
      condition?: ((n: unknown) => boolean | undefined) | boolean | undefined;
      content: unknown;
      name: string;
    }> } }).componentMeta;
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
        <NodeSelector node={node as never} />
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
    return (
      <div
        key={key}
        className="lc-borders-action"
        onClick={() => {
          c.action?.(node.internalToShellNode?.());
          const editor = node.document?.designer?.editor;
          const npm = node.componentMeta?.npm;
          const selected = [npm?.package, npm?.componentName].filter(Boolean).join('-') ||
            node.componentMeta?.componentName ||
            '';
          editor?.eventBus?.emit('designer.border.action', { name: key, selected });
        }}
        title={c.title}
      >
        {c.icon ? <span data-icon={c.icon.name} /> : null}
      </div>
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
  get instances(): unknown[] | null {
    return (this.host as unknown as { getComponentInstances: (n: unknown) => unknown[] | null }).getComponentInstances(this.props.node);
  }
  override render(): React.ReactNode {
    const { node } = this.props;
    const instances = this.instances;
    if (!instances || instances.length < 1) return null;
    return (
      <Fragment key={(node as { id: string }).id}>
        {instances.map((instance) => {
          const observed = (this.host as unknown as {
            createOffsetObserver: (opts: { node: unknown; instance: unknown }) => unknown;
          }).createOffsetObserver({ node, instance });
          if (!observed) return null;
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
    const selection = (doc as unknown as { selection: { getNodes: () => unknown[]; getTopNodes: () => unknown[] } }).selection;
    return this.dragging ? selection.getTopNodes() : selection.getNodes();
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
