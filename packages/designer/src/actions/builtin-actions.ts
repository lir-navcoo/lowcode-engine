/**
 * @monbolc/lowcode-designer — Built-in component actions (T2)
 *
 * 8 个默认组件动作(rename / duplicate / remove / copy / cut /
 * paste / moveUp / moveDown),供 L4 右键菜单使用。
 *
 * 设计要点:
 *   - 每个 action 都是纯函数 `(ctx) => boolean`,便于测试。
 *   - 通过 `IActionContext.document` 调用 document 的底层 API,
 *     不依赖具体的 `DocumentModel` 类(避免循环引用)。
 *   - cut 仅写剪贴板,**不**删除源节点(由 L4 决定是否一并触发
 *     RemoveCommand,与上游 alibaba 行为一致)。
 *   - moveUp / moveDown 边界(第一个/最后一个 sibling)直接返回
 *     `false`(no-op),不抛错。
 *   - 所有失败/缺条件的情况一律 `console.warn` 包装前缀
 *     `[designer]`,便于运维定位。
 */

import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';
import type {
  BuiltinActionName,
  ComponentAction,
  IActionContext,
  IActionNodeLike,
} from './action-types';

/**
 * 深拷贝 schema。优先使用 `structuredClone`,回退到 JSON 序列化
 * (会丢 `undefined` / 函数 / 符号,但低代码 schema 几乎不依赖这些)。
 */
function cloneSchema(src: IPublicTypeNodeSchema): IPublicTypeNodeSchema {
  if (typeof structuredClone === 'function') {
    return structuredClone(src) as IPublicTypeNodeSchema;
  }
  return JSON.parse(JSON.stringify(src)) as IPublicTypeNodeSchema;
}

/**
 * 把当前节点定位到 sibling-after 位置。如果当前节点是根的子节点,
 * 返回 `{ parent, index }`;否则(根节点)返回 `null`。
 */
function siblingAfter(
  ctx: IActionContext,
): { parent: IActionNodeLike | null; index: number } | null {
  if (!ctx.node) return null;
  const node = ctx.document.getNode(ctx.node.id);
  if (!node) return null;
  const parent: IActionNodeLike | null = node.parent;
  const siblings = parent?.schema.children ?? ctx.document.root.children ?? [];
  const idx = siblings.findIndex((c) => (c.key as string) === node.id);
  if (idx < 0) return null;
  return { parent, index: idx + 1 };
}

/**
 * 当前节点在父节点中的索引。根节点返回 `-1`。
 */
function indexInParent(ctx: IActionContext): number {
  if (!ctx.node) return -1;
  const node = ctx.document.getNode(ctx.node.id);
  if (!node) return -1;
  const parent = node.parent;
  const siblings = parent?.schema.children ?? ctx.document.root.children ?? [];
  return siblings.findIndex((c) => (c.key as string) === node.id);
}

/* ---------------------- 1. rename ---------------------- */

/**
 * rename: 提示输入新 componentName。L4 在 BaseUI Modal / inline
 * editor 中收集输入后,调用 `renameAction.run(ctx)` 时应把新名
 * 通过 `ctx.event.detail.newName` 传入(CustomEvent 即可)。
 *
 * 若未传新名,返回 `false`,由 L4 自己弹窗收集。
 */
const renameAction: ComponentAction = {
  name: 'rename',
  label: 'Rename',
  condition: (ctx) => !!ctx.node && ctx.node.componentName !== '',
  run: (ctx) => {
    if (!ctx.node) return false;
    const node = ctx.document.getNode(ctx.node.id);
    if (!node) return false;
    const detail = (ctx.event as (MouseEvent & { detail?: { newName?: string } }) | undefined)?.detail;
    if (!detail || typeof detail.newName !== 'string' || detail.newName.length === 0) {
      // 未传入新名,让 L4 自己处理弹窗
      return false;
    }
    if (detail.newName === node.componentName) return false;
    try {
      ctx.document.rename(node, detail.newName);
    } catch (err) {
      console.warn('[designer] rename failed', err);
      return false;
    }
    return true;
  },
};

/* ---------------------- 2. duplicate ---------------------- */

const duplicateAction: ComponentAction = {
  name: 'duplicate',
  label: 'Duplicate',
  condition: (ctx) => !!ctx.node,
  run: (ctx) => {
    if (!ctx.node) return false;
    const node = ctx.document.getNode(ctx.node.id);
    if (!node) return false;
    const after = siblingAfter(ctx);
    if (!after) return false;
    const cloned = cloneSchema(node.schema);
    // 清掉 key,document 会自动分配
    cloned.key = undefined;
    try {
      ctx.document.insert(cloned, after.parent, after.index);
    } catch (err) {
      console.warn('[designer] duplicate failed', err);
      return false;
    }
    return true;
  },
};

/* ---------------------- 3. remove ---------------------- */

const removeAction: ComponentAction = {
  name: 'remove',
  label: 'Remove',
  condition: (ctx) => !!ctx.node,
  run: (ctx) => {
    if (!ctx.node) return false;
    const node = ctx.document.getNode(ctx.node.id);
    if (!node) return false;
    // 根节点不允许移除
    if (node.parent === null) {
      console.warn('[designer] remove refused: cannot remove root');
      return false;
    }
    try {
      ctx.document.remove(node);
    } catch (err) {
      console.warn('[designer] remove failed', err);
      return false;
    }
    return true;
  },
};

/* ---------------------- 4. copy ---------------------- */

const copyAction: ComponentAction = {
  name: 'copy',
  label: 'Copy',
  condition: (ctx) => !!ctx.node,
  run: (ctx) => {
    if (!ctx.node) return false;
    const node = ctx.document.getNode(ctx.node.id);
    if (!node) return false;
    try {
      ctx.clipboard.write(cloneSchema(node.schema));
    } catch (err) {
      console.warn('[designer] copy failed', err);
      return false;
    }
    return true;
  },
};

/* ---------------------- 5. cut ---------------------- */

/**
 * cut: 写剪贴板,**不**删除源节点。是否一并 Remove 由 L4 决定,
 * 以便支持 cut-without-remove 的"拖到别处粘贴" UX。
 */
const cutAction: ComponentAction = {
  name: 'cut',
  label: 'Cut',
  condition: (ctx) => !!ctx.node,
  run: (ctx) => {
    if (!ctx.node) return false;
    const node = ctx.document.getNode(ctx.node.id);
    if (!node) return false;
    try {
      ctx.clipboard.write(cloneSchema(node.schema));
    } catch (err) {
      console.warn('[designer] cut failed', err);
      return false;
    }
    return true;
  },
};

/* ---------------------- 6. paste ---------------------- */

const pasteAction: ComponentAction = {
  name: 'paste',
  label: 'Paste',
  // paste 在 node=null 时也可以(粘贴到根)
  condition: (ctx) => ctx.clipboard.read() !== null,
  run: (ctx) => {
    const payload = ctx.clipboard.read();
    if (!payload) return false;
    const cloned = cloneSchema(payload);
    cloned.key = undefined;
    let parent: IActionNodeLike | null = null;
    let index = Number.MAX_SAFE_INTEGER;
    if (ctx.node) {
      const node = ctx.document.getNode(ctx.node.id);
      if (node) {
        const after = siblingAfter(ctx);
        if (after) {
          parent = after.parent;
          index = after.index;
        }
      }
    }
    try {
      ctx.document.insert(cloned, parent, index);
    } catch (err) {
      console.warn('[designer] paste failed', err);
      return false;
    }
    return true;
  },
};

/* ---------------------- 7. moveUp ---------------------- */

const moveUpAction: ComponentAction = {
  name: 'moveUp',
  label: 'Move up',
  condition: (ctx) => {
    if (!ctx.node) return false;
    return indexInParent(ctx) > 0;
  },
  run: (ctx) => {
    if (!ctx.node) return false;
    const node = ctx.document.getNode(ctx.node.id);
    if (!node) return false;
    const parent = node.parent;
    const idx = indexInParent(ctx);
    if (idx <= 0) return false; // 边界:已经是第一个
    try {
      ctx.document.move(node, parent, idx - 1);
    } catch (err) {
      console.warn('[designer] moveUp failed', err);
      return false;
    }
    return true;
  },
};

/* ---------------------- 8. moveDown ---------------------- */

const moveDownAction: ComponentAction = {
  name: 'moveDown',
  label: 'Move down',
  condition: (ctx) => {
    if (!ctx.node) return false;
    const node = ctx.document.getNode(ctx.node.id);
    if (!node) return false;
    const parent = node.parent;
    const siblings = parent?.schema.children ?? ctx.document.root.children ?? [];
    const idx = siblings.findIndex((c) => (c.key as string) === node.id);
    return idx >= 0 && idx < siblings.length - 1;
  },
  run: (ctx) => {
    if (!ctx.node) return false;
    const node = ctx.document.getNode(ctx.node.id);
    if (!node) return false;
    const parent = node.parent;
    const siblings = parent?.schema.children ?? ctx.document.root.children ?? [];
    const idx = siblings.findIndex((c) => (c.key as string) === node.id);
    if (idx < 0 || idx >= siblings.length - 1) return false; // 边界
    try {
      ctx.document.move(node, parent, idx + 1);
    } catch (err) {
      console.warn('[designer] moveDown failed', err);
      return false;
    }
    return true;
  },
};

/** 8 个默认动作的有序列表(L4 直接遍历)。 */
export const BUILTIN_COMPONENT_ACTIONS: ReadonlyArray<ComponentAction> = [
  renameAction,
  duplicateAction,
  removeAction,
  copyAction,
  cutAction,
  pasteAction,
  moveUpAction,
  moveDownAction,
];

/** 名字 → 动作 的快速查找表。 */
export const BUILTIN_ACTION_BY_NAME: Readonly<Record<BuiltinActionName, ComponentAction>> = {
  rename: renameAction,
  duplicate: duplicateAction,
  remove: removeAction,
  copy: copyAction,
  cut: cutAction,
  paste: pasteAction,
  moveUp: moveUpAction,
  moveDown: moveDownAction,
};

/** 默认 i18n key → 文案映射。L4 可通过 ctx.t 覆盖。 */
export const DEFAULT_ACTION_LABELS: Readonly<Record<BuiltinActionName, string>> = {
  rename: 'Rename',
  duplicate: 'Duplicate',
  remove: 'Remove',
  copy: 'Copy',
  cut: 'Cut',
  paste: 'Paste',
  moveUp: 'Move up',
  moveDown: 'Move down',
};

/** 默认 i18n key(L4 通过 ctx.t(key) 查找;若未注册走 fallback)。 */
export const DEFAULT_ACTION_I18N_KEYS: Readonly<Record<BuiltinActionName, string>> = {
  rename: 'designer.contextMenu.rename',
  duplicate: 'designer.contextMenu.duplicate',
  remove: 'designer.contextMenu.remove',
  copy: 'designer.contextMenu.copy',
  cut: 'designer.contextMenu.cut',
  paste: 'designer.contextMenu.paste',
  moveUp: 'designer.contextMenu.moveUp',
  moveDown: 'designer.contextMenu.moveDown',
};

/** 用 ctx.t 重写 label 后返回 action 副本(不修改原对象)。 */
export function localizeAction(action: ComponentAction, ctx: Pick<IActionContext, 't'>): ComponentAction {
  const key = DEFAULT_ACTION_I18N_KEYS[action.name];
  const localized = ctx.t(key, DEFAULT_ACTION_LABELS[action.name]);
  if (localized === action.label) return action;
  return { ...action, label: localized };
}