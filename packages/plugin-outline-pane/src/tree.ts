/**
 * @monbolc/lowcode-plugin-outline-pane — TreeNode
 *
 * In-memory representation of a node in the outline tree. Mirrors
 * the schema but optimized for tree display (flattened, with
 * children indices, etc.).
 */

import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

export interface ITreeNode {
  /** Stable id for React keys + selection. Defaults to a generated id. */
  id: string;
  /** Component name from the schema. */
  componentName: string;
  /** Display label (componentName or a custom title). */
  title: string;
  /** Optional icon URL or name. */
  icon?: string;
  /** Depth in the tree (0 = root). */
  depth: number;
  /** True if this node can have children. */
  canHaveChildren: boolean;
  /** True if children are visible. */
  expanded: boolean;
  /** True if the node is selected in the outline. */
  selected: boolean;
  /** True if the node is the current drop target during drag. */
  dropTarget?: boolean;
  /** Children indices — pointing back into the same flat array. */
  childrenIds: string[];
  /** Back-reference to the original schema node. */
  schema: IPublicTypeNodeSchema;
  /** The parent id, or empty string for root. */
  parentId: string;
}

/**
 * Convert a root schema into a flat ITreeNode[] with cross-references.
 * The flatten pass lets react-arborist render very large trees without
 * recursion.
 */
export function schemaToTreeNodes(root: IPublicTypeNodeSchema, rootId: string): ITreeNode[] {
  const out: ITreeNode[] = [];

  const visit = (node: IPublicTypeNodeSchema, parentId: string, depth: number, id: string): ITreeNode => {
    const childIds: string[] = (node.children ?? []).map((_, i) => `${id}/c${i}`);
    const treeNode: ITreeNode = {
      id,
      componentName: node.componentName,
      title: node.componentName,
      depth,
      canHaveChildren: (node.children?.length ?? 0) > 0,
      expanded: depth < 2, // auto-expand first 2 levels
      selected: false,
      childrenIds: childIds,
      schema: node,
      parentId,
    };
    out.push(treeNode);
    (node.children ?? []).forEach((child, i) => {
      visit(child, id, depth + 1, childIds[i]);
    });
    return treeNode;
  };

  visit(root, '', 0, rootId);
  return out;
}

/** Find a node by id, or undefined. */
export function findNode(nodes: ITreeNode[], id: string): ITreeNode | undefined {
  return nodes.find((n) => n.id === id);
}

/** All ids that should be initially open (root + auto-expanded). */
export function defaultOpenIds(nodes: ITreeNode[]): string[] {
  return nodes.filter((n) => n.expanded).map((n) => n.id);
}
