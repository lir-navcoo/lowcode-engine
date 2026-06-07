/**
 * @monbolc/lowcode-plugin-outline-pane — barrel export
 *
 * SapuLowcodeEngine outline pane (L2). A pure data + API layer, plus
 * a React-based OutlineView component for rendering the tree.
 */

export { OutlinePane } from './api';
export type { IOutlinePane, OutlinePaneEvents } from './api';

export { schemaToTreeNodes, findNode, defaultOpenIds } from './tree';
export type { ITreeNode } from './tree';

export { OutlineView } from './view';
export type { OutlineViewProps, RowHelpers } from './view';

import type { IEditor, IPlugin } from '@monbolc/lowcode-editor-core';
import type { IOutlinePane } from './api';
import { OutlinePane } from './api';

/**
 * Default plugin entry point. Registers the OutlinePane as a service
 * in the editor's DI container and provides a default `outlinePane`
 * accessor.
 */
export function createOutlinePanePlugin(): IPlugin {
  return {
    name: '@monbolc/plugin-outline-pane',
    init(ctx) {
      const pane: IOutlinePane = new OutlinePane();
      // Use the pane instance as its own DI lookup key.
      ctx.di.register<IOutlinePane>(() => pane, () => pane);
    },
  };
}
