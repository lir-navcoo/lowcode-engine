/**
 * @monbolc/lowcode-react-renderer — React runtime injection
 *
 * The renderer-core package exposes an `adapter` singleton that holds
 * the framework runtime. This file is the single place that imports
 * React 19.2.7 and pushes its primitives into the adapter.
 *
 * Calling `installReactRuntime()` is idempotent — calling it twice
 * with the same React module is a no-op.
 */

import {
  Component,
  PureComponent,
  createElement,
  createContext,
  forwardRef,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { adapter, type IRuntime } from '@monbolc/lowcode-renderer-core';

let _installed = false;

/**
 * Install React 19.2.7 as the framework runtime. After this returns,
 * any code that calls `adapter.getRuntime()` will receive React.
 */
export function installReactRuntime(): void {
  if (_installed) return;
  const runtime: IRuntime = {
    Component,
    PureComponent,
    createElement,
    createContext,
    forwardRef,
    // React 19 removed findDOMNode. We expose a no-op stub for back-compat
    // with the renderer-core IRuntime interface.
    findDOMNode: () => null,
  };
  adapter.setRuntime(runtime);
  adapter.setEnv('react');
  _installed = true;
}

/** Returns true if `installReactRuntime()` has been called in this process. */
export function isReactRuntimeInstalled(): boolean {
  return _installed;
}

/** Reset for tests. Re-runs the install on next call. */
export function uninstallReactRuntime(): void {
  _installed = false;
  adapter.initRuntime();
}

/**
 * Thin wrapper around `react-dom/client.createRoot`. Exposed so
 * L4+ consumers (editor-skeleton, plugin-designer, etc.) can mount
 * the engine into the page without importing react-dom directly.
 */
export function createReactRoot(container: Element | DocumentFragment): Root {
  return createRoot(container);
}
