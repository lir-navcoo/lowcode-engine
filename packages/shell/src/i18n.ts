/**
 * @monbolc/lowcode-shell — ShellI18n
 *
 * Slim i18n for the host-facing engine. Sapu stance: NO
 * `intl-messageformat` dep, NO mobx observer, NO ICU placeholder
 * support. Just a Map of dictionaries + one regex substitution for
 * `{varName}` placeholders. Plugin authors can extend via
 * `i18n.register({...})` at engine boot time.
 *
 * The full per-package dictionary lives at
 * `packages/shell/src/locale/{en-US,zh-CN}.json` and is wired in
 * `packages/shell/src/locale/index.ts` via `registerDefaultMessages`.
 */

import { Emitter } from '@monbolc/lowcode-utils';

export type SupportedLocale = 'en-US' | 'zh-CN';

export interface I18nMessage {
  /** Default fallback (en-US text by convention). */
  default: string;
  /** Per-locale overrides. */
  'en-US'?: string;
  'zh-CN'?: string;
}

export type I18nDictionary = Record<string, I18nMessage | string>;

/**
 * Phase D.I7b.20: typed event surface for ShellI18n. Ali-faithful
 * has a getter-only locale + an EventBus that fires on every
 * change. Slim port mirrors with a typed Emitter that
 * notifies on `setLocale`.
 */
export type ShellI18nEvents = {
  /** Fired after `setLocale` updates the active locale. */
  localeChanged: { from: SupportedLocale; to: SupportedLocale };
};

export class ShellI18n {
  private _locale: SupportedLocale = 'zh-CN';
  private readonly _dict = new Map<string, I18nMessage>();
  // Phase D.I7b.20: typed event emitter for localeChanged.
  // The pre-D.I7b.20 doc comment at line 33-37 referenced
  // `engine.i18n.events` (didn't exist); this is the
  // implementation.
  private readonly _events = new Emitter<ShellI18nEvents>();

  constructor() {
    // Default to zh-CN (sapu is built in China). Callers can flip
    // via `setLocale('en-US')` or pass `options.locale` to L7's
    // `init()`. The locale is plain string state — no mobx, no
    // observer. Callers can subscribe to `events` for reactive
    // locale changes (Phase D.I7b.20).
  }

  get locale(): SupportedLocale {
    return this._locale;
  }

  /** Phase D.I7b.20: typed event surface. Ali-faithful. */
  get events(): Emitter<ShellI18nEvents> {
    return this._events;
  }

  setLocale(locale: SupportedLocale): void {
    // Phase D.I7b.20: skip the emit when the locale is
    // unchanged (no-op optimization — matches the engineConfig
    // onGot pattern of D.I7b.19).
    if (this._locale === locale) return;
    const from = this._locale;
    this._locale = locale;
    this._events.emit('localeChanged', { from, to: locale });
  }

  /**
   * Phase D.I7b.20: convenience subscription for the
   * `localeChanged` event. Returns a disposer.
   * Ali-faithful: `i18n.localeChanged(fn) → () => void`.
   */
  onLocaleChange(fn: (loc: { from: SupportedLocale; to: SupportedLocale }) => void): () => void {
    return this._events.on('localeChanged', fn);
  }

  /**
   * Register one or more messages. Accepts two shorthand forms:
   *   register({ 'app.title': 'Hello' })                  // string
   *   register({ 'app.title': { default: 'Hello', 'en-US': 'Hello' } })
   *
   * String entries are normalized to `{ default: <string> }`.
   * Later `register` calls for the same key OVERWRITE earlier ones
   * — the host can override our default dictionary at boot.
   */
  register(messages: I18nDictionary): void {
    for (const [id, raw] of Object.entries(messages)) {
      this._dict.set(id, typeof raw === 'string' ? { default: raw } : raw);
    }
  }

  /**
   * Look up a message in the current locale.
   *
   *   - If the message has a per-locale override, use it.
   *   - Otherwise use `default`.
   *   - Otherwise return the key itself (so the UI shows the id
   *     instead of crashing on missing translations).
   *
   * If `vars` is provided, `{name}` placeholders in the resolved
   * string are replaced with `String(vars.name)`. Unknown `{name}`
   * placeholders are left untouched (so a typo doesn't get blanked).
   */
  t(id: string, vars?: Record<string, string | number>): string {
    const msg = this._dict.get(id);
    let text: string;
    if (!msg) {
      text = id;
    } else {
      text = msg[this._locale] ?? msg.default;
    }
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in vars ? String(vars[key]) : match,
      );
    }
    return text;
  }

  /** Test-only: clear all registered messages. */
  reset(): void {
    this._dict.clear();
  }
}
