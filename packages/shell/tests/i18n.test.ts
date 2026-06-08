/**
 * @monbolc/lowcode-shell — ShellI18n unit tests
 *
 * Covers the three P-task acceptance tests from
 * /Users/lirui/.claude/plans/radiant-wiggling-pizza.md (L6.5):
 *   1. t('app.title') returns the current-locale string
 *   2. setLocale('en-US') flips subsequent lookups
 *   3. t('...', { name: 'X' }) replaces `{name}` placeholders
 *
 * Plus a fourth test that covers the "missing key falls back to
 * the key itself" behavior — important for host UIs that want to
 * keep rendering when a translation hasn't been added yet.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { ShellI18n } from '../src/i18n';

describe('ShellI18n (L6.5)', () => {
  let i18n: ShellI18n;

  beforeEach(() => {
    i18n = new ShellI18n();
    i18n.register({
      'app.title': { default: 'SapuLowcodeEngine', 'en-US': 'Sapu Engine', 'zh-CN': 'Sapu 引擎' },
      'toast.hello': { default: 'Hello, {name}!' },
    });
  });

  it('t(id) returns the current-locale string', () => {
    // Default locale is zh-CN per the ShellI18n constructor.
    expect(i18n.t('app.title')).toBe('Sapu 引擎');
  });

  it('setLocale() flips subsequent lookups', () => {
    i18n.setLocale('en-US');
    expect(i18n.t('app.title')).toBe('Sapu Engine');
    i18n.setLocale('zh-CN');
    expect(i18n.t('app.title')).toBe('Sapu 引擎');
  });

  it('t(id, vars) replaces {name} placeholders', () => {
    i18n.setLocale('en-US');
    // 'toast.hello' has no per-locale overrides, so 'default' is used.
    expect(i18n.t('toast.hello', { name: 'World' })).toBe('Hello, World!');
  });

  it('t(missingId) returns the key itself (no crash)', () => {
    // The id is the fallback so host UIs can keep rendering.
    expect(i18n.t('not.registered')).toBe('not.registered');
  });

  it('register() accepts shorthand string form', () => {
    i18n.register({ 'short.key': 'Just a string' });
    expect(i18n.t('short.key')).toBe('Just a string');
  });

  it('placeholder for missing var is left untouched', () => {
    // If the template has {foo} but the caller doesn't supply it,
    // we leave the placeholder alone (typo-safe).
    expect(i18n.t('toast.hello', { name: 'X' })).toBe('Hello, X!');
    expect(i18n.t('toast.hello')).toBe('Hello, {name}!');
  });
});
