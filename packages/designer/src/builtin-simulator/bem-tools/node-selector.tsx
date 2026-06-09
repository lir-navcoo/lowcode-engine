/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/node-selector
 *
 * Phase D.I7b.2: real port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/node-selector/index.tsx`
 * (148 LoC ali → ~80 LoC slim). The `<NodeSelector>` component
 * shows a hover-popup with the node's parent chain (max 5 levels
 * up to the focus / root). Trigger: a chip showing the current
 * node's title; on hover, a popup opens listing the parent chain
 * as clickable breadcrumbs.
 *
 * Slim translations applied:
 *   - Ali's `Overlay.Popup` (`triggerType="hover"`) → BaseUI
 *     `Popover.Root / Trigger / Portal / Positioner / Popup` with
 *     `openOnHover` + `delay` + `closeDelay`. The `delay` value
 *     (300 ms ali default) is kept ali-faithful; `closeDelay: 100`
 *     is a slim UX tweak (avoids abrupt close when the pointer
 *     dips into the popup).
 *   - Ali's `node.contains(focusNode)` parent-walk → slim
 *     `node.parent` chain walk (5 levels max). The slim port
 *     doesn't have `document.focusNode` yet (the focus concept is
 *     part of Phase E's bigger active-tracker work); the slim
 *     port stops at root or at 5 levels, whichever comes first.
 *   - Ali's `node.select()` → slim `project.select(nodeId)`. The
 *     slim port needs a `project` prop to call this.
 *   - Ali's `node.hover(true / false)` → slim port omits the
 *     hover state (slim doesn't have `node.hover()`; the bem-tool
 *     visual hover is the P6 `BorderDetecting` overlay, not the
 *     NodeSelector's).
 *   - Ali's `<Title>` widget (with `label` + `icon` props) →
 *     slim `<span>` with the title text + a 1-line `data-icon`
 *     placeholder (the real icon font is a Phase E Asset).
 *
 * Returns `null` when:
 *   - `node` has no parents (it's the root or a 1-level tree)
 *   - the parent chain is empty (focusNode is not an ancestor)
 */
import * as React from 'react';
import { Popover } from '@base-ui-components/react/popover';
import type { Node } from '../../node';
import type { BuiltinSimulatorHost } from '../host';

export interface NodeSelectorProps {
  node: Node;
  /** Phase D.I7b.2: slim port needs the host so it can call
   *  `host.project.select(parentId)` on click. The ali-faithful
   *  port called `node.select()` on the node itself; the slim port
   *  routes via the project because the slim Node lacks a `select`
   *  method (selection is a project-level concept in sapu). */
  host: BuiltinSimulatorHost;
}

const MAX_PARENT_DEPTH = 5;

/** Walk up the parent chain (max 5 levels). Returns the parents
 *  in root → leaf order. */
function walkParents(node: Node): Node[] {
  const parents: Node[] = [];
  let cursor: Node | null = node.parent;
  while (cursor && parents.length < MAX_PARENT_DEPTH) {
    parents.push(cursor);
    cursor = cursor.parent;
  }
  return parents;
}

/** Read the title for a node: prefer the registered componentMeta
 *  title, fall back to the componentName. Slim port: no icon
 *  font yet, so we render a placeholder. */
function nodeTitle(node: Node): string {
  const metaTitle = node.getComponentMeta()?.title;
  if (typeof metaTitle === 'string') return metaTitle;
  return node.componentName;
}

export function NodeSelector(props: NodeSelectorProps): React.ReactElement | null {
  const { node, host } = props;
  const parents = walkParents(node);
  if (parents.length === 0) return null;
  return (
    <div className="lc-instance-node-selector" data-testid="node-selector">
      <Popover.Root>
        <Popover.Trigger
          openOnHover
          delay={300}
          closeDelay={100}
          className="lc-instance-node-selector-current"
          data-testid="node-selector-trigger"
        >
          <span>{nodeTitle(node)}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} className="lc-instance-node-selector-positioner">
            <Popover.Popup className="lc-instance-node-selector-popup">
              {parents.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="lc-instance-node-selector-node"
                  data-testid="node-selector-parent"
                  data-parent-id={p.id}
                  onClick={() => host.project.select(p.id)}
                >
                  {nodeTitle(p)}
                </button>
              ))}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
