/**
 * @monbolc/lowcode-workspace — EditorWindow unit tests
 */
import { describe, it, expect } from 'vitest';

import { Project } from '@monbolc/lowcode-designer';

import { Resource } from '../src/resource';
import { EditorWindow } from '../src/window';

const sampleRoot = { componentName: 'Page' };

function makeResource(id = 'r1', title = 'My Page') {
  return new Resource({ id, title, project: new Project(sampleRoot) });
}

describe('EditorWindow (L5.3)', () => {
  it('starts inactive by default', () => {
    const r = makeResource();
    const w = new EditorWindow(r);
    expect(w.active).toBe(false);
    expect(w.resource).toBe(r);
    expect(w.disposed).toBe(false);
  });

  it('honors the `active` constructor arg', () => {
    const r = makeResource();
    const w = new EditorWindow(r, true);
    expect(w.active).toBe(true);
  });

  it('fires `activate` on false → true, and only then', () => {
    const r = makeResource();
    const w = new EditorWindow(r);
    const seen: string[] = [];
    w.events.on('activate', (e) => seen.push(e.id));

    w.setActive(true);
    w.setActive(true); // no change → no event
    w.setActive(false); // false transition
    w.setActive(true);  // re-activate

    expect(seen).toEqual([r.id, r.id]);
  });

  it('fires `deactivate` on true → false', () => {
    const r = makeResource();
    const w = new EditorWindow(r, true);
    const seen: string[] = [];
    w.events.on('deactivate', (e) => seen.push(e.id));

    w.setActive(false);

    expect(seen).toEqual([r.id]);
  });

  it('ignores setActive calls after dispose', () => {
    const r = makeResource();
    const w = new EditorWindow(r);
    const seen: string[] = [];
    w.events.on('activate', (e) => seen.push(e.id));

    w.dispose();
    w.setActive(true);

    expect(seen).toEqual([]);
    expect(w.disposed).toBe(true);
  });

  it('getResource() returns the wrapped resource', () => {
    const r = makeResource();
    const w = new EditorWindow(r);
    expect(w.getResource()).toBe(r);
  });

  it('dispose() fires the disposed event exactly once and clears listeners', () => {
    const r = makeResource();
    const w = new EditorWindow(r);
    let disposeCount = 0;
    w.events.on('disposed', () => disposeCount++);

    w.dispose();
    w.dispose();

    expect(disposeCount).toBe(1);
    // After dispose, a fresh listener won't fire (bus was cleared).
    let postCount = 0;
    w.events.on('disposed', () => postCount++);
    w.dispose();
    expect(postCount).toBe(0);
  });
});
