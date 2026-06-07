/**
 * @monbolc/lowcode-ignitor
 *
 * Bootstrap entry for SapuLowcodeEngine development.
 * This package is the L0 "ignitor" — its only job is to start a dev server
 * and hand off to the engine proper (L7) once that is implemented.
 *
 * Currently a no-op placeholder. Subsequent layers will be wired in here.
 */

import type { IPublicApiEngine, IPublicEngineOptions } from '@monbolc/lowcode-types';

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
 * In the current L0 state, this just creates a placeholder div.
 * Once L7 (`engine`) ships, this will hand off to the real engine.
 */
export async function bootstrap(options: IPublicEngineOptions): Promise<IIgnitorContext> {
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
