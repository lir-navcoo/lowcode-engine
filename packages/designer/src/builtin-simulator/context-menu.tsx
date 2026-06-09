/**
 * @monbolc/lowcode-designer — builtin-simulator/context-menu
 *
 * Phase D.I7b.8: real port of
 * `alibaba/lowcode-engine/packages/designer/src/context-menu-actions.ts`
 * (232 LoC ali → ~120 LoC slim). The slim `<ContextMenu>`
 * component renders a right-click menu on a canvas node with
 * the default actions (Copy, Paste, Cut, Delete, Duplicate,
 * Insert sibling above / below). Each action calls the slim
 * DocumentCommands (already ported in P12 commit `db03df1`).
 *
 * Slim translations applied:
 *   - Ali's `@alifd/next` `Menu.create(...)` (imperative) →
 *     BaseUI `Menu` compound (Root / Trigger / Portal /
 *     Positioner / Popup / Item / Group / GroupLabel /
 *     SubmenuRoot). Declarative; the menu state lives in
 *     `host.contextMenuState` (a slim Observable).
 *   - Ali's `engineConfig.onGot('enableContextMenu')` global
 *     flag → slim port omits for v1 (the menu is always
 *     enabled in the slim demo; a future flag can be added
 *     via `engineConfig`).
 *   - Ali's `Map<ContextMenuActions>` plugin registry →
 *     slim port omits for v1 (the slim Project lacks the
 *     plugin-context-menu API; a follow-up can add
 *     `Project.contextMenuActions` if needed).
 *   - Ali's `createContextMenu` from `@alilc/lowcode-utils` →
 *     slim port constructs the React tree directly.
 *
 * Returns `null` when `host.contextMenuState` is `null` (no
 * menu is open). The state is set by `BuiltinSimulatorHost`'s
 * `contextmenu` event listener (D.I7b.8b) and cleared on item
 * click / outside click / Escape.
 */
import * as React from 'react';
import { Menu } from '@base-ui-components/react/menu';
import { RemoveCommand, ClipboardCommand, InsertCommand } from '../commands';
import type { DocumentModel } from '../document';
import type { BuiltinSimulatorHost } from './host';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

export interface ContextMenuState {
  /** The node under the right-click cursor. */
  readonly nodeId: string;
  /** Cursor clientX (used to position the menu). */
  readonly x: number;
  /** Cursor clientY. */
  readonly y: number;
}

export interface ContextMenuProps {
  host: BuiltinSimulatorHost;
  /** The current menu state, or `null` if no menu is open. */
  state: ContextMenuState | null;
  /** Close the menu (clears the host's `contextMenuState`). */
  onClose: () => void;
}

interface DefaultAction {
  id: string;
  label: string;
  /** The action to run. Receives the project + document + nodeId. */
  run: (project: { document: DocumentModel } & { getClipboard(): unknown; setClipboard(p: unknown): void }, doc: DocumentModel, nodeId: string) => void;
}

const DEFAULT_ACTIONS: DefaultAction[] = [
  {
    id: 'copy',
    label: 'Copy',
    run: (project, _doc, nodeId) => {
      const c = new ClipboardCommand(project as never);
      c.execute({ op: 'copy', nodeId });
    },
  },
  {
    id: 'paste-after',
    label: 'Paste after',
    run: (project, doc, nodeId) => {
      const c = new ClipboardCommand(project as never);
      const node = doc.getNode(nodeId);
      const parent = node?.parent;
      const parentId = parent?.id ?? null;
      const index = parent
        ? parent.schema.children!.indexOf(node!.schema) + 1
        : 0;
      c.execute({ op: 'paste', parentId, index });
    },
  },
  {
    id: 'cut',
    label: 'Cut',
    run: (project, _doc, nodeId) => {
      const c = new ClipboardCommand(project as never);
      c.execute({ op: 'cut', nodeId });
    },
  },
  { id: 'sep1', label: '---', run: () => undefined },
  {
    id: 'duplicate',
    label: 'Duplicate',
    run: (project, doc, nodeId) => {
      const c = new ClipboardCommand(project as never);
      const node = doc.getNode(nodeId);
      const parent = node?.parent;
      const parentId = parent?.id ?? null;
      const index = parent
        ? parent.schema.children!.indexOf(node!.schema) + 1
        : 0;
      c.execute({ op: 'copy', nodeId });
      c.execute({ op: 'paste', parentId, index });
    },
  },
  {
    id: 'insert-above',
    label: 'Insert sibling above',
    run: (_project, doc, nodeId) => {
      const node = doc.getNode(nodeId);
      if (!node) return;
      const parent = node.parent;
      const parentId = parent?.id ?? null;
      const index = parent
        ? parent.schema.children!.indexOf(node.schema)
        : 0;
      const c = new InsertCommand(doc);
      c.execute({ schema: { componentName: 'Div' } as IPublicTypeNodeSchema, parentId, index });
    },
  },
  {
    id: 'insert-below',
    label: 'Insert sibling below',
    run: (_project, doc, nodeId) => {
      const node = doc.getNode(nodeId);
      if (!node) return;
      const parent = node.parent;
      const parentId = parent?.id ?? null;
      const index = parent
        ? parent.schema.children!.indexOf(node.schema) + 1
        : 0;
      const c = new InsertCommand(doc);
      c.execute({ schema: { componentName: 'Div' } as IPublicTypeNodeSchema, parentId, index });
    },
  },
  { id: 'sep2', label: '---', run: () => undefined },
  {
    id: 'delete',
    label: 'Delete',
    run: (_project, doc, nodeId) => {
      const c = new RemoveCommand(doc);
      c.execute({ nodeId });
    },
  },
];

function ContextMenuRaw(props: ContextMenuProps): React.ReactElement | null {
  const { host, state, onClose } = props;
  if (!state) return null;
  // Pass the project (not just the document) so ClipboardCommand
  // can read/write the project's clipboard state. The other
  // commands (Insert, Remove) only need the document, but
  // they accept the document via the same path.
  const project = host.project;
  const doc = project.document;
  const handleAction = (action: DefaultAction) => {
    action.run(project as never, doc, state.nodeId);
    onClose();
  };
  return (
    <Menu.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Menu.Portal>
        <Menu.Positioner
          sideOffset={4}
          anchor={() => {
            // Anchor the menu at the cursor position. BaseUI
            // expects a virtual element with getBoundingClientRect.
            const x = state.x;
            const y = state.y;
            return {
              getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
            };
          }}
          className="lc-context-menu-positioner"
          data-testid="context-menu"
        >
          <Menu.Popup className="lc-context-menu-popup">
            {DEFAULT_ACTIONS.map((action) =>
              action.label === '---' ? (
                <Menu.Separator
                  key={action.id}
                  data-testid={`context-menu-sep-${action.id}`}
                />
              ) : (
                <Menu.Item
                  key={action.id}
                  data-testid={`context-menu-${action.id}`}
                  className="lc-context-menu-item"
                  onClick={() => handleAction(action)}
                >
                  {action.label}
                </Menu.Item>
              ),
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export const ContextMenu = ContextMenuRaw;
ContextMenuRaw.displayName = 'ContextMenu';
