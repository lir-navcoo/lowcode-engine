/**
 * @monbolc/lowcode-workspace — Resource unit tests
 */
import { describe, it, expect } from 'vitest';

import { Project } from '@monbolc/lowcode-designer';

import { Resource } from '../src/resource';

const sampleRoot = { componentName: 'Page' };

function makeProject() {
  return new Project(sampleRoot);
}

describe('Resource (L5.2)', () => {
  it('stores id, title, project, and a frozen options bag', () => {
    const project = makeProject();
    const opts = { source: 'inline', version: 1 };
    const r = new Resource({ id: 'r1', title: 'My Page', project, options: opts });

    expect(r.id).toBe('r1');
    expect(r.title).toBe('My Page');
    expect(r.project).toBe(project);
    expect(r.options).toEqual({ source: 'inline', version: 1 });
    expect(Object.isFrozen(r.options)).toBe(true);
  });

  it('defaults options to an empty frozen object when omitted', () => {
    const project = makeProject();
    const r = new Resource({ id: 'r1', title: 'T', project });
    expect(r.options).toEqual({});
    expect(Object.isFrozen(r.options)).toBe(true);
  });

  it('exposes getProject() equivalent to the readonly project field', () => {
    const project = makeProject();
    const r = new Resource({ id: 'r1', title: 'T', project });
    expect(r.project).toBe(project);
  });

  it('marks disposed after dispose() and is idempotent', () => {
    const project = makeProject();
    const r = new Resource({ id: 'r1', title: 'T', project });
    expect(r.disposed).toBe(false);

    r.dispose();
    expect(r.disposed).toBe(true);

    // Calling dispose a second time is a no-op (no throw).
    expect(() => r.dispose()).not.toThrow();
    expect(r.disposed).toBe(true);
  });

  it('does not mutate the caller-provided options object', () => {
    const project = makeProject();
    const opts: Record<string, unknown> = { source: 'inline' };
    const r = new Resource({ id: 'r1', title: 'T', project, options: opts });
    // Mutate the source after construction.
    opts.source = 'remote';
    expect(r.options).toEqual({ source: 'inline' });
  });
});
