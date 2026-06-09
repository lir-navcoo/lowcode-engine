/**
 * @monbolc/lowcode-designer — Component actions (T2)
 *
 * 默认右键菜单动作接口:8 个内置动作(rename / duplicate / remove /
 * copy / cut / paste / moveUp / moveDown)共享一个 `IActionContext`,
 * 通过 `ComponentAction` 类型注册到上下文菜单。
 *
 * 上游参考 alibaba v1.3.2 `designer/src/component-actions.ts` 与
 * `designer/src/context-menu-actions.ts`(本轨为 slim 重写,无第三方
 * 依赖,不直接调用上游 Fusion Menu 组件)。
 */

import type {
  IPublicTypeNodeLike,
  IPublicTypeNodeSchema,
  IPublicTypeRootSchema,
} from '@monbolc/lowcode-types';
import type { Project } from '../project';

/** 内置动作名联合类型。L4 上下文菜单用此枚举渲染条目。 */
export type BuiltinActionName =
  | 'rename'
  | 'duplicate'
  | 'remove'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'moveUp'
  | 'moveDown';

/**
 * 轻量数据剪贴板(L2 概念),与 Project 的 schema clipboard 不同。
 * 此处只用于 L4 右键菜单交互时的复制/粘贴动作,不写入 OS 剪贴板。
 */
export interface IContextClipboard {
  read(): IPublicTypeNodeSchema | null;
  write(node: IPublicTypeNodeSchema): void;
  clear(): void;
}

/**
 * Node 视图的最小结构子集——`IActionDocument` 依赖的形状。
 * 真实 `Node` 实例满足此结构。
 */
export interface IActionNodeLike {
  readonly id: string;
  readonly componentName: string;
  readonly parent: IActionNodeLike | null;
  readonly schema: IPublicTypeNodeSchema;
  readonly children: Array<IActionNodeLike>;
}

/**
 * 文档操作子集——`builtin-actions.ts` 只依赖 document 的
 * `getNode` / `insert` / `remove` / `rename` / `move`。
 *
 * 这里故意采用结构化类型(`IActionNodeLike`),不直接依赖 `DocumentModel`
 * 类,以便测试可传 mock;运行时传入真实 `DocumentModel` 也满足此契约。
 */
export interface IActionDocument {
  getNode(id: string): IActionNodeLike | undefined;
  insert(schema: IPublicTypeNodeSchema, parent: IActionNodeLike | null, index: number): IActionNodeLike;
  remove(node: IActionNodeLike): void;
  rename(node: IActionNodeLike, newName: string): void;
  move(node: IActionNodeLike, newParent: IActionNodeLike | null, newIndex: number): void;
  readonly root: IPublicTypeRootSchema;
}

/**
 * 单一动作执行时的上下文。L4 把项目运行时拼装好传入。
 *
 * - `node`: 当前操作的节点(右键时命中的节点)。`null` 表示菜单开在
 *   空白区域,大多数动作将据此返回 `false`。
 * - `document`: 当前文档(可以传 `DocumentModel` 实例,也可以传测试
 *   mock)。
 * - `project`: 当前项目,主要用于触发 `nodeRenamed` / `nodeRemoved`
 *   等事件供其他监听者使用。
 * - `clipboard`: L4 维护的轻量剪贴板,只有 copy/cut/paste 用到。
 * - `t`: 国际化函数,缺省实现 `key → key`。
 */
export interface IActionContext {
  node: IPublicTypeNodeLike | null;
  document: IActionDocument;
  project: Pick<Project, 'events'>;
  /** 拖拽引擎(预留,当前 8 个动作不直接使用) */
  dragon?: unknown;
  /** 右键事件(可选,某些 L4 适配器需要坐标信息) */
  event?: MouseEvent;
  clipboard: IContextClipboard;
  t(key: string, fallback?: string): string;
}

/**
 * 谓词门控:返回 `false` 时该动作既不显示也不可执行。插件可以扩展
 * 或覆盖默认谓词(例如 `rename` 仅对容器节点开放)。
 */
export type ActionCondition = (ctx: IActionContext) => boolean;

/**
 * 一个组件动作的最小契约。
 *
 * - `name`: 动作名(对应 `BuiltinActionName`)。
 * - `label`: 显示文本(已经过 i18n,可以直接渲染)。
 * - `condition`: 可选,谓词门控。
 * - `run`: 执行动作;返回 `false` 表示"未执行",L4 据此决定是否关闭
 *   菜单或回滚 UI。
 */
export interface ComponentAction {
  name: BuiltinActionName;
  label: string;
  condition?: ActionCondition;
  run: (ctx: IActionContext) => boolean | Promise<boolean>;
}