/**
 * @monbolc/lowcode-types — 展示层类型 (i18n / title / icon)
 *
 * 上游参考: `alibaba/lowcode-engine` v1.3.2
 * `types/src/shell/type/{i8n-data,title-content,title-config,icon-type,icon-config}.ts`
 *
 * 差异 (sapu slim 端口):
 * - 上游的 `ReactNode` / `ReactElement` / `ComponentType` 引用改为
 *   `unknown` + JSDoc `@see React.ReactNode` 提示。本包是 L0 纯类型
 *   层,不引入 React 类型;消费方做窄化。
 * - `IPublicTypeTitleProps`(上游 23 行)未引入 —— 它是 React 组件
 *   props 形状,属于 L3+ 层;L0 只承诺 config / content 形状。
 */

/**
 * 国际化文案。
 *
 * `intl` 在上游是 `ReactNode`,sapu 用 `string` —— 实际 i18n
 * 落地几乎都是字符串(带 `{name}` 占位),消费方按需 cast。
 *
 * `[key: string]: unknown` 允许消费方塞额外字段(如 `intl-id`),
 * 但 sapu 自身不解释这些字段。
 */
export interface IPublicTypeI18nData {
  type: 'i18n';
  /** i18n 键对应的字符串(由 engine.i18n 解析)。 */
  intl?: string;
  /** 透传字段(消费方约定)。 */
  [key: string]: unknown;
}

/**
 * 图标配置(对象形态)。
 *
 * 与字符串形态互斥(见 `IPublicTypeIconType`)。
 */
export interface IPublicTypeIconConfig {
  /** 图标组件名或 URL(由消费方解释)。 */
  type: string;
  /**
   * 大小。可以是像素数字,也可以是上游约定的预设字符串;
   * 预设大小由 `SapuIcon` 消费(`packages/utils/src/icon.tsx`)。
   */
  size?: number | 'small' | 'xxs' | 'xs' | 'medium' | 'large' | 'xl' | 'xxl' | 'xxxl' | 'inherit';
  /** 透传 CSS class。 */
  className?: string;
}

/**
 * 图标 —— 字符串 URL、组件、配置对象三选一。
 *
 * 上游的 `ReactElement | ComponentType<any>` 在 sapu 用 `unknown`
 * 代替 —— 本包不引入 React 类型,消费方窄化。
 */
export type IPublicTypeIconType =
  | string
  | unknown
  | IPublicTypeIconConfig;

/**
 * 标题的"形状"配置,用于需要图标/链接/提示的标题。
 */
export interface IPublicTypeTitleConfig {
  /** 主文字。 */
  label?: IPublicTypeI18nData | string;
  /** hover 后的提示内容(字符串或 i18n)。 */
  tip?: string | IPublicTypeI18nData;
  /** 文档链接(可选,host 自行决定是否渲染)。 */
  docUrl?: string;
  /** 关联图标。 */
  icon?: IPublicTypeIconType;
  /** 透传 CSS class。 */
  className?: string;
}

/**
 * 标题内容 —— 字符串、i18n 数据、React 节点(显示为
 * `unknown`)、Title 配置四选一。
 *
 * 上游的 `ReactElement | ReactNode` 在 sapu 用 `unknown` 代替;
 * 消费方窄化。
 */
export type IPublicTypeTitleContent =
  | string
  | IPublicTypeI18nData
  | unknown
  | IPublicTypeTitleConfig;
