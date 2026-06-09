/**
 * @monbolc/lowcode-designer — builtin-simulator/bem-tools/node-selector
 * Ali-mirror Phase D.I7 stub: the `NodeSelector` parent-walker.
 *
 * Slim port: 30-LoC minimal stub. The full `<NodeSelector>` (130 LoC
 * ali) uses `@alifd/next`'s `Overlay.Popup` to show a hover-popup with
 * the node's parent chain. Sapu's slim port needs BaseUI's `Popover`
 * compound component, which is a separate port (D.I7 follow-up).
 *
 * For now, this stub returns `null`. The full BaseUI Popover port
 * (Popover.Root / Trigger / Portal / Positioner / Popup) is in the
 * follow-up D.I7b commit; this commit's scope is BorderSelecting +
 * dropLocation + createOffsetObserver.
 */
import * as React from 'react';
import type { Node } from '../../node';

export interface NodeSelectorProps {
  node: Node;
}

export function NodeSelector(_props: NodeSelectorProps): React.ReactElement | null {
  // Slim port: real implementation lands in D.I7b (BaseUI Popover).
  return null;
}
