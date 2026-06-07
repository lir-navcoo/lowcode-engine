import { describe, it, expect } from 'vitest';
import { I18nImpl } from '../src/i18n';

describe('I18nImpl', () => {
  it('returns default for missing id when no fallback given', () => {
    const i = new I18nImpl();
    expect(i.t('missing')).toBe('missing');
  });
  it('returns fallback when provided', () => {
    const i = new I18nImpl();
    expect(i.t('missing', undefined, 'FB')).toBe('FB');
  });
  it('returns default when no locale set', () => {
    const i = new I18nImpl();
    i.register({ greet: { default: 'Hello', byLocale: { zh_CN: '你好' } } });
    expect(i.t('greet')).toBe('Hello');
  });
  it('returns locale-specific when set', () => {
    const i = new I18nImpl();
    i.register({ greet: { default: 'Hello', byLocale: { zh_CN: '你好' } } });
    i.setLocale('zh_CN');
    expect(i.t('greet')).toBe('你好');
  });
  it('per-call locale argument overrides global', () => {
    const i = new I18nImpl();
    i.setLocale('zh_CN');
    i.register({ greet: { default: 'Hello', byLocale: { en_US: 'Hi', zh_CN: '你好' } } });
    expect(i.t('greet', 'en_US', 'fallback')).toBe('Hi');
  });
  it('accepts string shorthand', () => {
    const i = new I18nImpl();
    i.register({ x: 'simple' });
    expect(i.t('x')).toBe('simple');
  });
  it('falls back to default when locale has no override', () => {
    const i = new I18nImpl();
    i.register({ x: { default: 'D', byLocale: { en_US: 'E' } } });
    i.setLocale('fr_FR');
    expect(i.t('x')).toBe('D');
  });
  it('size reflects registered ids', () => {
    const i = new I18nImpl();
    expect(i.size()).toBe(0);
    i.register({ a: 'A', b: 'B' });
    expect(i.size()).toBe(2);
  });
});
