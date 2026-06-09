/**
 * @monbolc/lowcode-types — 拖放位置 (location) 类型
 *
 * 上游参考: `alibaba/lowcode-engine` v1.3.2
 * `types/src/shell/type/location.ts`
 *
 * 差异 (sapu slim 端口):
 * - `IPublicTypeRect` 已在 `@monbolc/lowcode-designer` 的
 *   `simulator-host.ts` 定义(并被 `IPublicTypeComponentInstance`
 *   引用),本文件**不**重新定义以避免类型冲突。
 * - `IPublicModelNode` 引用改为 `IPublicTypeNodeLike`(本包
 *   `drag.ts` 中已定义的最窄公共形状)。
 * - `IPublicModelLocateEvent` 引用改为 `unknown` + JSDoc
 *   `@see`(本包不重导出 model 层)。
 * - 上游的 `@deprecated` 旧 `LocationDetailType` 枚举已删除
 *   (sapu 无 back-compat 负担)。
 */

import type { IPublicTypeNodeLike } from './drag';

// ---------- 1. 位置细节类型 (枚举) ----------

/**
 * 拖放位置细节的两大类别:作为容器的子节点插入,或作为 prop 引用。
 */
export enum IPublicTypeLocationDetailType {
  /** 作为子节点插入到容器。 */
  Children = 'Children',
  /** 作为某个 prop 的值。 */
  Prop = 'Prop',
}

// ---------- 2. 位置细节:Children / Prop ----------

/**
 * 当 `IPublicTypeLocationDetailType.Children` 时,描述容器内的插入点。
 *
 * `near.node` / `focus.node` 使用 `IPublicTypeNodeLike` 而非上游
 * 的 `IPublicModelNode`,因为本包只承诺"id + componentName" 形状;
 * 消费方(如 `IPublicModelNode` 实现类)做窄化。
 */
export interface IPublicTypeLocationChildrenDetail {
  type: IPublicTypeLocationDetailType.Children;
  /** 目标容器内的子节点索引,`null` 表示"未指定"。 */
  index?: number | null;
  /** 是否为有效落点(无障碍检查、nesting rule 等)。 */
  valid?: boolean;
  /** 视觉高亮的占位矩形。 */
  edge?: DOMRect;
  /** 紧邻的参考节点,用于"插入到 X 之前/之后"语义。 */
  near?: {
    node: IPublicTypeNodeLike;
    pos: 'before' | 'after' | 'replace';
    /** 参考节点的精确矩形(若可计算)。 */
    rect?: DOMRect;
    /** 视觉对齐方向,`V` = 垂直(上下)/ `H` = 水平(左右)。 */
    align?: 'V' | 'H';
  };
  /** 焦点是节点的某个 slot 还是整个节点。 */
  focus?: { type: 'slots' } | { type: 'node'; node: IPublicTypeNodeLike };
}

/**
 * 当 `IPublicTypeLocationDetailType.Prop` 时,描述挂到 prop 的位置。
 */
export interface IPublicTypeLocationPropDetail {
  type: IPublicTypeLocationDetailType.Prop;
  /** 目标 prop 的名字。 */
  name: string;
  /** 高亮的 DOM 节点;若为空则用容器自身。 */
  domNode?: HTMLElement;
}

/**
 * 拖放位置细节,联合类型。
 *
 * 上游的 `{ [key: string]: any; type: string }` 兜底分支已删除
 * (sapu 走窄类型 + 消费者类型守卫)。
 */
export type IPublicTypeLocationDetail =
  | IPublicTypeLocationChildrenDetail
  | IPublicTypeLocationPropDetail;

// ---------- 3. 位置数据 (locate 事件负载) ----------

/**
 * 拖放位置数据,由 `Dragon.locate` 事件发出。
 *
 * `event` 字段在上游是 `IPublicModelLocateEvent`,sapu 改用
 * `unknown` —— 消费方(reader)做窄化。
 */
export interface IPublicTypeLocationData<
  TNode extends IPublicTypeNodeLike = IPublicTypeNodeLike,
> {
  /** 落点目标节点(容器或被替换的节点)。 */
  target: TNode;
  /** 落点细节。 */
  detail: IPublicTypeLocationDetail;
  /** 来源(组件名 / 资产 id / schema 引用等),用于审计和日志。 */
  source: string;
  /**
   * 触发此次定位的原始事件,具体形状由 `Dragon` 实现决定。
   * 消费方应窄化到自己的事件类型再做字段访问。
   */
  event: unknown;
}
