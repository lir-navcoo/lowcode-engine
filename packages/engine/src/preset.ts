/**
 * @monbolc/lowcode-engine — createDefaultPreset
 *
 * A preset is the "what plugins + what locale + what theme"
 * triple. The default preset wires the 3 built-in plugins and
 * picks `'zh-CN'` + `'light'`. Hosts can override any field via
 * the partial parameter.
 *
 * Sapu stance: no preset registry, no `default-preset` plugin
 * chain. The preset is a plain object the host composes.
 */

import type { IPlugin } from '@monbolc/lowcode-shell';
import type { SupportedLocale } from '@monbolc/lowcode-shell';

import { createDefaultPlugins } from './default-plugins';

export type SupportedTheme = 'light' | 'dark';

export interface Preset {
  /** The plugins to register (in order) on engine init. */
  plugins: IPlugin[];
  /** The initial i18n locale. */
  locale: SupportedLocale;
  /** The initial UI theme. */
  theme: SupportedTheme;
}

/**
 * The default preset. The user can override any of the three
 * fields; non-overridden fields keep the default values.
 *
 *   const preset = createDefaultPreset({ theme: 'dark' });
 *   // → { plugins: [outline, settings, setters], locale: 'zh-CN', theme: 'dark' }
 */
export function createDefaultPreset(overrides?: Partial<Preset>): Preset {
  return {
    plugins: overrides?.plugins ?? createDefaultPlugins(),
    locale: overrides?.locale ?? 'zh-CN',
    theme: overrides?.theme ?? 'light',
  };
}
