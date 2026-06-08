/**
 * @monbolc/lowcode-shell — locale dictionary loader
 *
 * Two parallel JSON files keep translation work easy to diff and
 * merge. The English file is the canonical source — each entry has
 * an explicit `{ default, 'en-US', 'zh-CN' }` triple. The zh-CN
 * file is the shorthand form (`'app.title': '中文'`) used at runtime
 * as a per-locale override of the English default.
 *
 * The `registerDefaultMessages` function is the ONE entry point
 * the host calls to populate the dictionary. Sapu stance: no
 * `intl-messageformat`, no `FormatJS`, no ICU plural support —
 * just a Map<string, I18nMessage> + a `{var}` regex (see
 * `../i18n.ts`).
 *
 * Hosts can override individual messages at any time via
 * `engine.i18n.register({...})`.
 */

import type { I18nDictionary } from '../i18n';
import enUS from './en-US.json';
import zhCN from './zh-CN.json';

export const defaultLocale = 'zh-CN' as const;

/**
 * The full set of default messages, keyed by message id. The
 * English file is the canonical shape (each entry is a full
 * `I18nMessage` triple); the zh-CN file is a shorthand map
 * (string → string) that gets merged in as per-locale overrides.
 */
export const defaultMessages: I18nDictionary = {
  ...enUS,
  // The zh-CN JSON is shorthand; spread it on top so the
  // per-locale override takes effect when i18n.locale === 'zh-CN'.
  ...zhCN,
};

/**
 * Register the default messages on the given i18n instance.
 * Returns the same instance for chaining.
 *
 *   engine.i18n.register(registerDefaultMessages());
 */
export function registerDefaultMessages(): I18nDictionary {
  return defaultMessages;
}
