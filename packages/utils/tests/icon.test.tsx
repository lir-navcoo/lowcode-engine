/**
 * @monbolc/lowcode-utils — SapuIcon 测试
 *
 * 覆盖 6 档 size preset、自定义数字 size、className 透传、默认
 * viewBox、`fill` 与 `style.color` 合并行为、未知 type 静默渲染、
 * 自定义 viewBox。所有 DOM 断言走 `@testing-library/react` 的
 * `render`,环境 happy-dom(见根 `vitest.config.ts`)。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { SapuIcon, type SapuIconProps } from '../src/icon';

afterEach(() => cleanup());

function renderIcon(extra: Partial<SapuIconProps> & { className?: string } = {}): SVGSVGElement {
  const { container } = render(
    <SapuIcon type="demo" {...(extra as object)} />,
  );
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('SapuIcon did not render an <svg> element');
  return svg as SVGSVGElement;
}

describe('SapuIcon — size presets', () => {
  const cases: Array<[SapuIconProps['size'], number]> = [
    ['small', 12],
    ['medium', 16],
    ['large', 20],
    ['xl', 24],
    ['xxl', 32],
    ['xxxl', 48],
  ];

  for (const [preset, px] of cases) {
    it(`size=${preset} 渲染为 ${px}px`, () => {
      const svg = renderIcon({ size: preset });
      expect(svg.tagName.toLowerCase()).toBe('svg');
      expect(svg).toHaveAttribute('width', String(px));
      expect(svg).toHaveAttribute('height', String(px));
    });
  }
});

describe('SapuIcon — 自定义与默认行为', () => {
  it('自定义数字 size 生效', () => {
    const svg = renderIcon({ size: 36 });
    expect(svg).toHaveAttribute('width', '36');
    expect(svg).toHaveAttribute('height', '36');
  });

  it('未传 size 时默认 medium (16px)', () => {
    const svg = renderIcon();
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });

  it('className 透传到 svg 元素', () => {
    const svg = renderIcon({ className: 'lc-icon lc-icon--demo' });
    expect(svg).toHaveClass('lc-icon');
    expect(svg).toHaveClass('lc-icon--demo');
  });

  it('缺 viewBox 时默认 0 0 1024 1024', () => {
    const svg = renderIcon();
    expect(svg).toHaveAttribute('viewBox', '0 0 1024 1024');
  });

  it('自定义 viewBox 生效', () => {
    const svg = renderIcon({ viewBox: '0 0 24 24' });
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('data-icon-type 透传 type 字符串', () => {
    const svg = renderIcon({ type: 'arrow-down' });
    expect(svg).toHaveAttribute('data-icon-type', 'arrow-down');
  });
});

describe('SapuIcon — fill 与 style.color 合并', () => {
  it('fill 单独传 → svg fill 属性与 style.color 同步为 fill', () => {
    const svg = renderIcon({ fill: '#ff0000' });
    expect(svg).toHaveAttribute('fill', '#ff0000');
    expect(svg.style.color).toBe('#ff0000');
  });

  it('缺 fill 时默认 currentColor', () => {
    const svg = renderIcon();
    expect(svg).toHaveAttribute('fill', 'currentColor');
  });

  it('fill 与 style.color 同时传 → style.color 胜出,svg fill 保留', () => {
    const svg = renderIcon({
      fill: '#ff0000',
      style: { color: '#00ff00' },
    });
    expect(svg.style.color).toBe('#00ff00');
    // fill 属性仍保留传入值(便于 hover/active 切色)
    expect(svg).toHaveAttribute('fill', '#ff0000');
  });

  it('style 中非 color 字段与 fill 合并不冲突', () => {
    const svg = renderIcon({
      fill: '#000',
      style: { marginTop: 4, opacity: 0.5 },
    });
    expect(svg.style.color).toBe('#000');
    expect(svg.style.marginTop).toBe('4px');
    expect(svg.style.opacity).toBe('0.5');
  });
});

describe('SapuIcon — 健壮性', () => {
  it('type=unknown 不抛错,渲染空 svg', () => {
    expect(() => renderIcon({ type: 'this-icon-does-not-exist' })).not.toThrow();
    const { container } = render(
      <SapuIcon type="this-icon-does-not-exist" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.tagName.toLowerCase()).toBe('svg');
    // 壳子始终存在;具体 glyph 留给下游 icon-pack 包。
    expect(svg!.children.length).toBe(0);
  });

  it('未识别的 size 字符串 fallback 到 medium', () => {
    const { container } = render(
      // @ts-expect-error 故意传未列出的字符串
      <SapuIcon type="demo" size="gigantic" />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });
});