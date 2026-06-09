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
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

  // Phase D.I7b.20: localeChanged event. Ali-faithful: i18n
  // is reactive; the slim port pre-D.I7b.20 had no event
  // surface at all (the doc comment at i18n.ts:33-37
  // referenced `engine.i18n.events` which didn't exist).
  // D.I7b.20 wires a typed `events: Emitter<{ localeChanged:
  // { from, to } }>` and a convenience `onLocaleChange`
  // subscription.

  it('localeChanged: fires on setLocale with from/to (D.I7b.20)', () => {
    const cb = vi.fn();
    i18n.onLocaleChange(cb);
    i18n.setLocale('en-US');
    expect(cb).toHaveBeenCalledWith({ from: 'zh-CN', to: 'en-US' });
  });

  it('localeChanged: does NOT fire when the locale is unchanged (D.I7b.20)', () => {
    const cb = vi.fn();
    i18n.onLocaleChange(cb);
    i18n.setLocale('zh-CN'); // same as default
    expect(cb).not.toHaveBeenCalled();
  });

  it('localeChanged: multiple subscribers all fire (D.I7b.20)', () => {
    const a = vi.fn();
    const b = vi.fn();
    i18n.onLocaleChange(a);
    i18n.onLocaleChange(b);
    i18n.setLocale('en-US');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('onLocaleChange: returned disposer stops the subscription (D.I7b.20)', () => {
    const cb = vi.fn();
    const dispose = i18n.onLocaleChange(cb);
    i18n.setLocale('en-US');
    expect(cb).toHaveBeenCalledTimes(1);
    dispose();
    i18n.setLocale('zh-CN');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
