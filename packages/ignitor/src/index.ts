/**
 * @monbolc/lowcode-ignitor
 *
 * Bootstrap entry for SapuLowcodeEngine development.
 *
 * ⚠️  DEPRECATED since 2026-06-08 (v2.2.0-rc). The L7
 * `@monbolc/lowcode-engine` package is the new home for the real
 * `init()` composition root. `bootstrap()` is kept as a shim that
 * prints a deprecation warning and falls through to a "SapuLowcodeEngine
 * not implemented" banner — same behavior as before L7.
 *
 * Migration:
 *   import { bootstrap } from '@monbolc/lowcode-ignitor';   // ❌ deprecated
 *   import { init }      from '@monbolc/lowcode-engine';    // ✅ new
 *
 * The `ignitor` package will be removed in 2.3.0.
 */

import type { IPublicApiEngine, IPublicEngineOptions } from '@monbolc/lowcode-types';

let hasWarnedDeprecated = false;

function warnDeprecated(): void {
  if (hasWarnedDeprecated) return;
  hasWarnedDeprecated = true;
  // eslint-disable-next-line no-console
  console.warn(
    '[lowcode-ignitor] DEPRECATED in 2.2.0. Use `import { init } from "@monbolc/lowcode-engine"` instead. The ignitor package will be removed in 2.3.0.',
  );
}

export type { IPublicApiEngine, IPublicEngineOptions };

export interface IIgnitorContext {
  /** The host DOM element the engine will mount into. */
  container: HTMLElement;

  /** Engine instance after init. Undefined before init. */
  engine?: IPublicApiEngine;

  /** Free-form callbacks for hot-reload / watch mode. */
  hooks?: {
    onChange?: (file: string) => void | Promise<void>;
    onReload?: () => void | Promise<void>;
  };
}

/**
 * Bootstrap the engine.
 *
 * ⚠️  DEPRECATED. See the file header for the migration path.
 *
 * In the current L0 state, this just creates a placeholder div.
 * Once L7 (`engine`) ships, this will hand off to the real engine.
 */
export async function bootstrap(options: IPublicEngineOptions): Promise<IIgnitorContext> {
  warnDeprecated();

  const container =
    typeof options.container === 'string'
      ? document.querySelector<HTMLElement>(options.container)
      : options.container;

  if (!container) {
    throw new Error(
      `[ignitor] Container not found: ${
        typeof options.container === 'string' ? options.container : '<HTMLElement>'
      }`,
    );
  }

  // L0 placeholder: print a friendly banner.
  // Will be replaced by `engine.init(options)` in a later layer.
  container.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #888;
    ">
      <div style="text-align: center;">
        <h1 style="font-size: 28px; margin: 0;">SapuLowcodeEngine</h1>
        <p style="margin: 8px 0 0;">L0 bootstrap ready. Engine core not yet implemented.</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #aaa;">
          Theme: <code>${options.theme ?? 'light'}</code>
        </p>
      </div>
    </div>
  `;

  return { container };
}

/**
 * Default export for `import sapu from '@monbolc/lowcode-ignitor'` users.
 */
export default { bootstrap };
