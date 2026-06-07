/**
 * @monbolc/lowcode-renderer-core — Adapter
 *
 * Singleton that holds the injected framework runtime. Renderers read
 * from here instead of importing React directly. This keeps
 * renderer-core framework-agnostic — a Vue or Solid adapter could be
 * plugged in by setting a different runtime.
 */

import { uid } from '@monbolc/lowcode-utils';

import type {
  IConfigProvider,
  IRenderComponent,
  IRendererModules,
  IRuntime,
} from './types';

/**
 * The names of runtime fields that must be present for a runtime to
 * be considered valid. `findDOMNode` is optional because React 19
 * removed it.
 */
const REQUIRED_RUNTIME_MODULES: ReadonlyArray<keyof IRuntime> = [
  'Component',
  'PureComponent',
  'createElement',
  'createContext',
  'forwardRef',
];

class Adapter {
  readonly id: string = uid('adapter');
  runtime: IRuntime;
  renderers: Partial<IRendererModules> = {};
  configProvider?: IConfigProvider;
  env: 'react' | 'unknown' = 'unknown';

  constructor() {
    this.runtime = this.makeStubRuntime();
  }

  /**
   * Install a real runtime. Throws if required modules are missing.
   */
  setRuntime(runtime: IRuntime): void {
    if (!this.isValidRuntime(runtime)) {
      throw new Error(
        `[adapter:${this.id}] runtime is invalid — missing one of ${REQUIRED_RUNTIME_MODULES.join(', ')}`,
      );
    }
    this.runtime = runtime;
    this.env = 'react'; // best guess; concrete adapter overrides if needed
  }

  /**
   * Reset the runtime to the no-op stub. Useful in tests.
   */
  initRuntime(): void {
    this.runtime = this.makeStubRuntime();
    this.env = 'unknown';
  }

  /**
   * Check that all required runtime modules are present (and not null).
   */
  isValidRuntime(runtime: IRuntime): boolean {
    if (!runtime || typeof runtime !== 'object') return false;
    for (const key of REQUIRED_RUNTIME_MODULES) {
      if (runtime[key] === undefined || runtime[key] === null) {
        throw new Error(`[adapter] runtime is missing required module "${key}"`);
      }
    }
    return true;
  }

  getRuntime(): IRuntime {
    return this.runtime;
  }

  setEnv(env: 'react' | 'unknown'): void {
    this.env = env;
  }

  isReact(): boolean {
    return this.env === 'react';
  }

  setRenderers(renderers: Partial<IRendererModules>): void {
    this.renderers = renderers;
  }

  getRenderers(): Partial<IRendererModules> {
    return this.renderers;
  }

  setConfigProvider(component: IConfigProvider): void {
    this.configProvider = component;
  }

  getConfigProvider(): IConfigProvider | undefined {
    return this.configProvider;
  }

  /**
   * Walk the configured renderers and find one whose name matches the
   * provided schema's `componentName`. Returns `undefined` if no match.
   */
  pickRenderer(schema: { componentName?: string }): IRenderComponent | undefined {
    const name = schema.componentName ?? '';
    // Convention: schema.componentName === 'Page' → PageRenderer; etc.
    if (name === 'Page' || name === 'PageRenderer') return this.renderers.PageRenderer;
    if (name === 'Block' || name === 'BlockRenderer') return this.renderers.BlockRenderer;
    if (name === 'Addon' || name === 'AddonRenderer') return this.renderers.AddonRenderer;
    if (name === 'Temp' || name === 'TempRenderer') return this.renderers.TempRenderer;
    if (name === 'Div' || name === 'DivRenderer') return this.renderers.DivRenderer;
    return this.renderers.ComponentRenderer;
  }

  /**
   * A no-op runtime for environments that have not yet injected one
   * (e.g. during tests, or before the React adapter loads).
   */
  private makeStubRuntime(): IRuntime {
    return {
      Component: class Stub {
        state: unknown;
        props: unknown;
        setState() { /* noop */ }
        forceUpdate() { /* noop */ }
        render(): unknown { return null; }
      },
      PureComponent: class Stub {
        state: unknown;
        props: unknown;
        setState() { /* noop */ }
        forceUpdate() { /* noop */ }
        render(): unknown { return null; }
      },
      createElement: () => null,
      createContext: () => ({ Provider: () => null, Consumer: () => null }),
      forwardRef: (fn: unknown) => fn,
      findDOMNode: () => null,
    };
  }
}

/** Process-wide singleton. */
export const adapter = new Adapter();
