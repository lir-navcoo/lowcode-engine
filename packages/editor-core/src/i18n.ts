/**
 * @monbolc/lowcode-editor-core — I18n
 *
 * Tiny internationalization helper. Plugins call `i18n.register({...})`
 * to add strings; consumers call `i18n.t('pluginName.someKey')` to get
 * a string in the active locale (or the default if missing).
 *
 * Shape: { default: string, byLocale?: Record<locale, string> }
 * Example:
 *   i18n.register({ 'designer.duplicate': { default: 'Duplicate', byLocale: { zh_CN: '复制' } } });
 *   i18n.t('designer.duplicate');          // 'Duplicate' (or '复制' if locale='zh_CN')
 */

import type { I18n, I18nMessage } from './types';

export class I18nImpl implements I18n {
  private readonly messages = new Map<string, I18nMessage>();
  private _locale: string = '';

  get locale(): string {
    return this._locale;
  }

  setLocale(locale: string): void {
    this._locale = locale ?? '';
  }

  register(messages: Record<string, I18nMessage | string>): void {
    for (const [id, value] of Object.entries(messages)) {
      // Allow shorthand: `'foo': 'Hello'` instead of `{ default: 'Hello' }`.
      const normalized: I18nMessage =
        typeof value === 'string' ? { default: value } : value;
      this.messages.set(id, normalized);
    }
  }

  t(id: string, locale?: string, fallback?: string): string {
    const msg = this.messages.get(id);
    if (!msg) {
      if (fallback !== undefined) return fallback;
      // Last resort: return the id itself so missing translations are visible.
      return id;
    }
    const activeLocale = locale ?? this._locale;
    if (activeLocale && msg.byLocale?.[activeLocale] !== undefined) {
      return msg.byLocale[activeLocale];
    }
    return msg.default;
  }

  /** Number of registered message ids. */
  size(): number {
    return this.messages.size;
  }
}
