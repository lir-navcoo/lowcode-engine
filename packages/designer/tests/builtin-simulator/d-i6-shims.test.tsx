/**
 * @monbolc/lowcode-designer — D.I6 shim tests
 * Tests for `engineConfig`, `intl` / `globalLocale`, and `<Title>`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { engineConfig } from '../../src/utils/engine-config';
import { intl, globalLocale } from '../../src/utils/locale';
import { Title } from '../../src/components/title';

afterEach(() => { cleanup(); engineConfig.clear(); });

describe('engineConfig (Phase D.I6)', () => {
  it('get returns undefined for unset keys', () => {
    expect(engineConfig.get('disableDetecting')).toBeUndefined();
  });
  it('set + get round-trips', () => {
    engineConfig.set('disableDetecting', true);
    expect(engineConfig.get('disableDetecting')).toBe(true);
  });
  it('has returns the correct value', () => {
    expect(engineConfig.has('flag')).toBe(false);
    engineConfig.set('flag', 1);
    expect(engineConfig.has('flag')).toBe(true);
  });
  it('remove deletes the key', () => {
    engineConfig.set('flag', 1);
    expect(engineConfig.remove('flag')).toBe(true);
    expect(engineConfig.has('flag')).toBe(false);
  });
  it('clear wipes all keys', () => {
    engineConfig.set('a', 1);
    engineConfig.set('b', 2);
    engineConfig.clear();
    expect(engineConfig.get('a')).toBeUndefined();
  });
});

describe('intl + globalLocale (Phase D.I6)', () => {
  it('intl("Item") returns the fallback', () => {
    expect(intl('Item')).toBe('Item');
  });
  it('intl("locked") returns the fallback (zh-CN)', () => {
    expect(intl('locked')).toBe('已锁定');
  });
  it('intl(unknown) returns the key (passthrough)', () => {
    expect(intl('mystery-key')).toBe('mystery-key');
  });
  it('globalLocale.getLocale() returns the fallback', () => {
    expect(globalLocale.getLocale()).toBe('zh-CN');
  });
  it('globalLocale.setLocale does not throw', () => {
    expect(() => globalLocale.setLocale('en-US')).not.toThrow();
  });
});

describe('<Title> (Phase D.I6)', () => {
  it('renders a string title', () => {
    render(<Title title="hello" />);
    expect(screen.getByText('hello')).toBeTruthy();
  });
  it('renders an I18nData-shape title', () => {
    render(<Title title={{ type: 'i18n', value: 'i18n-label' } as never} />);
    expect(screen.getByText('i18n-label')).toBeTruthy();
  });
  it('renders a ReactNode title', () => {
    render(<Title title={<span data-testid="x">jsx-label</span>} />);
    expect(screen.getByTestId('x').textContent).toBe('jsx-label');
  });
  it('applies className to the outer div', () => {
    const { container } = render(<Title title="x" className="my-cls" />);
    expect(container.querySelector('.my-cls')).toBeTruthy();
  });
  it('renders empty when title is undefined', () => {
    const { container } = render(<Title title={undefined} />);
    expect(container.textContent).toBe('');
  });
});
