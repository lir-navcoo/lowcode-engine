import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { adapter } from '@monbolc/lowcode-renderer-core';
import {
  installReactRuntime,
  isReactRuntimeInstalled,
  uninstallReactRuntime,
  createReactRoot,
} from '../src/inject';

describe('React runtime injection', () => {
  beforeEach(() => {
    uninstallReactRuntime();
  });
  afterEach(() => {
    uninstallReactRuntime();
  });

  it('installReactRuntime pushes React into the adapter', () => {
    installReactRuntime();
    expect(isReactRuntimeInstalled()).toBe(true);
    const r = adapter.getRuntime();
    expect(r.Component.name).toBe('Component'); // React's Component class
    expect(r.createElement).toBeTypeOf('function');
    expect(adapter.isReact()).toBe(true);
  });

  it('installReactRuntime is idempotent', () => {
    installReactRuntime();
    const first = adapter.getRuntime();
    installReactRuntime();
    const second = adapter.getRuntime();
    expect(first).toBe(second);
  });

  it('uninstallReactRuntime restores the stub', () => {
    installReactRuntime();
    uninstallReactRuntime();
    expect(isReactRuntimeInstalled()).toBe(false);
    const r = adapter.getRuntime();
    // The stub Component is a class but not React's
    expect(r.Component.name).not.toBe('Component');
  });

  it('createReactRoot returns a Root instance', () => {
    installReactRuntime();
    const container = document.createElement('div');
    const root = createReactRoot(container);
    expect(root).toBeDefined();
    expect(typeof root.render).toBe('function');
    expect(typeof root.unmount).toBe('function');
    // Cleanup: unmount to avoid leaks
    root.unmount();
  });
});
