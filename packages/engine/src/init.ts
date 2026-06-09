/**
 * @monbolc/lowcode-engine — init(container, options)
 *
 * The composition root. Takes a DOM container + an options bag and
 * returns a fully-mounted `SapuEngine`. The host can keep the
 * reference and call `destroy(engine)` to tear it down.
 *
 * Sapu stance:
 *   - One `init` call, not a chain of `register` calls. The host
 *     gets the engine back; everything else is private.
 *   - `init` is `async` because the React mount via `createRoot`
 *     could be async in the future (concurrent rendering). For
 *     now the body is sync but the signature is async so consumers
 *     don't have to refactor when the internals change.
 *   - The default preset is applied; the host can override any
 *     field via `options.preset`.
 */

import { setupReactRenderer } from '@monbolc/lowcode-react-renderer';
import {
  SapuEngine,
  registerDefaultMessages,
  type ISapuEngine,
  type MountOptions,
} from '@monbolc/lowcode-shell';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

import { createDefaultPreset, type Preset } from './preset';
import { setTheme } from './theme';

export interface InitOptions {
  /** The root schema the editor will load. */
  schema: IPublicTypeRootSchema;
  /** Component registry passed to the simulator. */
  components: Record<string, unknown>;
  /** Optional preset override. Defaults to `createDefaultPreset()`. */
  preset?: Partial<Preset>;
  /** Optional locale (defaults to `detectLocale()`). */
  locale?: 'en-US' | 'zh-CN';
  /** Optional initial theme (defaults to `'light'`). */
  theme?: 'light' | 'dark';
}

/**
 * Resolve a string selector OR an HTMLElement to an HTMLElement.
 * Throws if the element is missing or the selector matches nothing.
 */
function resolveContainer(container: HTMLElement | string): HTMLElement {
  if (typeof container === 'string') {
    const el = document.querySelector(container);
    if (!(el instanceof HTMLElement)) {
      throw new Error(
        `[init] container selector "${container}" did not match an HTMLElement`,
      );
    }
    return el;
  }
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('[init] container must be an HTMLElement or a non-empty string selector');
  }
  return container;
}

/**
 * Pick a sensible default locale from the browser. Falls back to
 * `'zh-CN'` (sapu is built in China) when the navigator API is
 * unavailable (e.g. SSR or tests).
 */
export function detectLocale(): 'en-US' | 'zh-CN' {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return 'zh-CN';
  }
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

/**
 * The composition root. Mounts a Skeleton-less engine into the
 * container — the React tree is the host's responsibility (it can
 * either render `<SapuErrorBoundary>` + `<Skeleton project={engine.getProject()} />`
 * itself, or it can call `init` from inside a React component and
 * use the returned engine to get the project).
 *
 * For the simplest case (which the L7.7 demo demonstrates), the
 * host calls `init` outside the React tree and uses the engine's
 * `getProject()` reference inside.
 */
export async function init(
  container: HTMLElement | string,
  options: InitOptions,
): Promise<ISapuEngine> {
  const host = resolveContainer(container);

  // Install the React 19 runtime into renderer-core's adapter.
  // Idempotent — calling it twice is safe.
  setupReactRenderer();

  // Merge the user's preset overrides on top of the default.
  const preset = createDefaultPreset(options.preset);

  // Build the engine. The host owns the bus + i18n + Project
  // through this single reference.
  const engine = new SapuEngine();
  engine.i18n.register(registerDefaultMessages());
  engine.i18n.setLocale(options.locale ?? preset.locale);

  // Register every preset plugin in order. The SapuEngine catches
  // init() throws and fires `pluginError`; we still iterate so a
  // single bad plugin doesn't block the rest.
  for (const plugin of preset.plugins) {
    engine.registerPlugin(plugin);
  }

  // Phase D.I7b.17: apply the host's theme on boot. `options.theme`
  // is in the InitOptions interface but the slim port was
  // silently ignoring it (the demo worked around by calling
  // setTheme('dark') after init). Ali-faithful: the theme
  // should be active at boot, not a post-init workaround.
  // The theme module is a module-level singleton (not on
  // SapuEngine); the import is at the top of this file.
  setTheme(options.theme ?? preset.theme);

  // Mount the project. From this point the engine is "live" and
  // listeners on `engineReady` (attached before this call) have
  // already fired synchronously.
  const mountOpts: MountOptions = {
    schema: options.schema,
    components: options.components,
  };
  engine.mount(mountOpts);

  // Stash a back-reference to the host element so `destroy()`
  // can clear it. We also fire the `themeChanged` event for the
  // initial theme so subscribers can pick it up uniformly.
  // Phase D.I7b.18: use the typed setHost / getHost API
  // (the old `engine as unknown as { _host: HTMLElement }` cast
  // is gone).
  engine.setHost(host);

  return engine;
}

/**
 * Tear down an engine. Calls `engine.destroy()` (which calls
 * `destroy()` on every registered plugin in reverse insertion
 * order, then emits `engineDestroyed`), and clears the host
 * element's children.
 */
export function destroy(engine: ISapuEngine): void {
  // Phase D.I7b.18: use the typed getHost() API (the old
  // `engine as unknown as { _host?: HTMLElement }` cast is gone).
  const host = engine.getHost();
  engine.destroy();
  if (host) {
    // Defensive: clear any rendered children. The host's React
    // tree may have already unmounted itself on `engineDestroyed`,
    // but flushing here is cheap and prevents stale DOM.
    while (host.firstChild) host.removeChild(host.firstChild);
  }
}
