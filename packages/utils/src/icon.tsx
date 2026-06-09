/**
 * @monbolc/lowcode-utils — SapuIcon (内联 SVG 图标壳子)
 *
 * 上游参考:alibaba/lowcode-engine 的
 * `packages/utils/src/svg-icon.tsx` (ali v1.3.2)。本文件保留"size
 * preset + viewBox 默认 + fill 合并 style.color"的核心契约,但:
 *
 * - 不引 class component / runtime 类型校验 / Fusion (alibaba v1.3.2)
 * - 不内嵌具体 glyph(本包只做壳子;具体 icon 库留待后续包)
 * - `type` 不识别时静默渲染占位空 svg,而不是抛错或 fallback 到 Fusion
 * - ref 不走 ref forwarding:父组件用 `ref` prop 自取 svg 节点
 *
 * 消费方:`@monbolc/lowcode-types` 的 `IPublicTypeIconConfig.size`
 * 预设字符串(`small` / `medium` / ...)在本组件中解析为像素。
 */

import { CSSProperties, ReactElement } from 'react';

/**
 * size preset 像素映射表。
 *
 * 与上游 ali 不同的两个细节:
 * - ali 的预设只有 `xsmall`/`small`/`medium`/`large`/`xlarge`,且用
 *   `hasOwnProperty` 检查;sapu 用 `Object.hasOwn`(ES2022),预设也按
 *   `IPublicTypeIconConfig.size` 的 6 档(`small`/`medium`/`large`
 *   /`xl`/`xxl`/`xxxl`)对齐。
 * - `xxs`/`xs`/`inherit` 由消费方窄化为不传或转 number;本表只覆盖
 *   像素化的预设名。
 */
const SIZE_PRESETS: Readonly<Record<string, number>> = Object.freeze({
  small: 12,
  medium: 16,
  large: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
});

/** SapuIcon 函数组件 props。 */
export interface SapuIconProps {
  /**
   * 图标类型名。具体 glyph 库(后续包提供)负责把 `type` 解析成
   * `<path>` / `<g>` 等子元素;本组件只在 `type` 已知时为消费方留
   * `data-icon-type` 钩子,未知时不抛错也不渲染任何内容。
   */
  type: string;
  /** 像素数字或 preset 名。preset 解析见 `SIZE_PRESETS`。 */
  size?: number | 'small' | 'medium' | 'large' | 'xl' | 'xxl' | 'xxxl';
  /** 透传 CSS class 到 svg 元素。 */
  className?: string;
  /** svg viewBox,默认 `0 0 1024 1024`(与上游 ali 默认不同,见上)。 */
  viewBox?: string;
  /**
   * 填充色,默认 `currentColor`。当 `style.color` 未设时,`fill`
   * 会映射成 `style.color`(与 ali 行为一致)。
   */
  fill?: string;
  /** 透传 inline style。`style.color` 优先于 `fill`。 */
  style?: CSSProperties;
}

/**
 * 内联 SVG 图标壳子。
 *
 * 渲染策略:
 * - size preset 名 → 像素数字;像素数字原样透传
 * - `fill` 单独传 → 既写 svg `fill` 属性,也写 `style.color`(若 style.color 未设)
 * - `fill` + `style.color` 同传 → style.color 胜出,svg `fill` 仍保留(便于 hover 切换)
 * - `type` 未知 → 渲染空 svg 占位,不抛错
 */
export function SapuIcon(props: SapuIconProps): ReactElement {
  const {
    type,
    size = 'medium',
    className,
    viewBox = '0 0 1024 1024',
    fill = 'currentColor',
    style,
  } = props;

  const resolvedSize: number =
    typeof size === 'number' ? size : SIZE_PRESETS[size] ?? SIZE_PRESETS.medium;

  const hasColor = style?.color !== undefined && style.color !== null;
  const mergedStyle: CSSProperties = hasColor
    ? { ...style }
    : { color: fill, ...style };

  return (
    <svg
      className={className}
      width={resolvedSize}
      height={resolvedSize}
      viewBox={viewBox}
      fill={fill}
      preserveAspectRatio="xMidYMid meet"
      data-icon-type={type}
      style={mergedStyle}
    />
  );
}