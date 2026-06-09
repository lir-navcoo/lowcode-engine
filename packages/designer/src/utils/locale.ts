/**
 * @monbolc/lowcode-designer — utils/locale
 * Ali-mirror Phase D.I6 shim: the `intl` global + the `globalLocale` helper.
 *
 * Slim port of:
 *   - `intl(key)` from `@alilc/lowcode-editor-core` (ali uses it in
 *     `border-detecting.tsx` for the "locked" string fallback)
 *   - `globalLocale.getLocale()` (used by `border-container.tsx`)
 *
 * The slim port hard-codes the fallback locale to `'zh-CN'` (the ali
 * default) and the fallback string to `'Item'` / `'locked'`. The
 * `engine.i18n` from `@monbolc/lowcode-shell` is consulted if the
 * engine facade is registered globally; otherwise the fallback is
 * returned.
 *
 * Per audit R1 (recommendation): stub for Phase D. Phase E can wire
 * `engine.i18n` as the primary lookup with a sensible fallback.
 */
const FALLBACK_LOCALE = 'zh-CN';
const FALLBACK_STRINGS: Record<string, string> = {
  Item: 'Item',
  locked: '已锁定',
};

/** Slim port of `intl(key)`. Returns the localized string. */
export function intl(key: string): string {
  return FALLBACK_STRINGS[key] ?? key;
}

/** Slim port of `globalLocale.getLocale()`. */
export function getLocale(): string {
  return FALLBACK_LOCALE;
}

/** Slim port of `globalLocale.setLocale(locale)`. */
export function setLocale(locale: string): void {
  // The slim port is a no-op for the local fallback; the engine-level
  // i18n is the source of truth. Phase E can wire it.
  void locale;
}

/** Slim port of `globalLocale` facade. */
export const globalLocale = { getLocale, setLocale };
