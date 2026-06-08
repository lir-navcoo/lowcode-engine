/**
 * @monbolc/lowcode-designer — Phase C.AB tests
 * Project / DocumentModel autorun / reaction shims
 *
 * Per `~/.claude/plans/dynamic-marinating-rabbit.md` Phase C. Closes
 * the last "API parity with ali" gap. Ali's `IDesigner.autorun(fn)`
 * and `IDesigner.reaction(track, effect)` are plugin-facing shims
 * that let consumers track MULTIPLE observables in one go
 * (re-run on ANY tracked change). Sapu gets the same surface —
 * a plugin written against ali's API works in sapu with zero
 * import changes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Observable } from '@monbolc/lowcode-utils';
import { Project } from '../src/project';
import { DocumentModel } from '../src/document';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const mkRoot = (): IPublicTypeRootSchema => ({
  componentName: 'Page',
  props: {},
  children: [],
});

describe('Project.autorun (Phase C.AB)', () => {
  let project: Project;
  beforeEach(() => {
    project = new Project(mkRoot());
  });

  it('runs the effect once at start (initial render)', () => {
    // document.nodes.size starts at 1 (the root node is indexed
    // by the DocumentModel constructor).
    const seen: number[] = [];
    project.autorun(() => { seen.push(project.document.nodes.size); });
    expect(seen).toEqual([1]);
  });

  it('re-runs when a tracked Observable changes', () => {
    const o = new Observable<number>(1);
    const seen: number[] = [];
    project.autorun(() => { seen.push(o.get()); });
    expect(seen).toEqual([1]);
    o.set(2);
    expect(seen).toEqual([1, 2]);
    o.set(3);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('re-runs when a different tracked Observable changes (multi-observable tracking)', () => {
    const a = new Observable<number>(1);
    const b = new Observable<string>('x');
    const seen: Array<{ a: number; b: string }> = [];
    project.autorun(() => { seen.push({ a: a.get(), b: b.get() }); });
    expect(seen).toEqual([{ a: 1, b: 'x' }]);
    a.set(2);
    expect(seen).toEqual([{ a: 1, b: 'x' }, { a: 2, b: 'x' }]);
    b.set('y');
    expect(seen).toEqual([{ a: 1, b: 'x' }, { a: 2, b: 'x' }, { a: 2, b: 'y' }]);
  });

  it('returns a disposer that stops re-fires', () => {
    const o = new Observable<number>(1);
    let count = 0;
    const dispose = project.autorun(() => { o.get(); count++; });
    expect(count).toBe(1);
    o.set(2);
    expect(count).toBe(2);
    dispose();
    o.set(3);
    expect(count).toBe(2);
  });
});

describe('Project.reaction (Phase C.AB)', () => {
  let project: Project;
  beforeEach(() => {
    project = new Project(mkRoot());
  });

  it('does NOT fire on the initial run (MobX-aligned)', () => {
    const o = new Observable<number>(1);
    const seen: Array<{ next: number; prev: number }> = [];
    project.reaction(() => [o.get()] as const, (next, prev) => { seen.push({ next: next[0], prev: prev[0] }); });
    expect(seen).toEqual([]);
  });

  it('fires with [next, prev] when a tracked value changes', () => {
    const o = new Observable<number>(1);
    const seen: Array<{ next: number; prev: number }> = [];
    project.reaction(() => [o.get()] as const, (next, prev) => { seen.push({ next: next[0], prev: prev[0] }); });
    o.set(2);
    expect(seen).toEqual([{ next: 2, prev: 1 }]);
    o.set(5);
    expect(seen).toEqual([{ next: 2, prev: 1 }, { next: 5, prev: 2 }]);
  });

  it('tracks multiple values in the tuple', () => {
    const a = new Observable<number>(1);
    const b = new Observable<string>('x');
    const seen: Array<{ a: number; b: string }> = [];
    project.reaction(
      () => [a.get(), b.get()] as const,
      (next) => { seen.push({ a: next[0], b: next[1] }); },
    );
    a.set(2);
    expect(seen).toEqual([{ a: 2, b: 'x' }]);
    b.set('y');
    expect(seen).toEqual([{ a: 2, b: 'x' }, { a: 2, b: 'y' }]);
  });

  it('returns a disposer that stops further fires', () => {
    const o = new Observable<number>(1);
    let count = 0;
    const dispose = project.reaction(() => [o.get()] as const, () => { count++; });
    o.set(2);
    expect(count).toBe(1);
    dispose();
    o.set(3);
    expect(count).toBe(1);
  });
});

describe('DocumentModel.autorun / reaction (Phase C.AB)', () => {
  // Note: DocumentModel's properties (`nodes`, `root`, etc.) are
  // plain JS getters — NOT Observable-lite. So `document.autorun`
  // re-runs only when an explicit `Observable.get()` is read
  // inside the effect. The shim still exists for symmetry with
  // ali's IDocumentModel and for the (future) case where
  // document properties become observable (Phase D's setting
  // tree work will likely add Observables for the document
  // state).
  let document: DocumentModel;
  beforeEach(() => {
    document = new DocumentModel(mkRoot());
  });

  it('document.autorun runs the effect once at start', () => {
    let count = 0;
    document.autorun(() => { count++; });
    expect(count).toBe(1);
  });

  it('document.autorun re-runs when an Observable read inside the effect changes', () => {
    // The shim delegates to Phase A's autorun. The re-run trigger
    // is an Observable read — the document's own getters are
    // plain JS, so to test the re-run path we use an external
    // Observable. This proves the shim wires correctly; it
    // doesn't assert on document-internal reactivity (which
    // isn't observable in the slim DesignModel yet).
    const o = new Observable<number>(1);
    const seen: number[] = [];
    document.autorun(() => { seen.push(o.get()); });
    o.set(2);
    expect(seen).toEqual([1, 2]);
  });

  it('document.reaction fires on tracked value changes', () => {
    const o = new Observable<number>(1);
    const seen: number[] = [];
    document.reaction(() => [o.get()] as const, (next) => { seen.push(next[0]); });
    o.set(2);
    expect(seen).toEqual([2]);
  });

  it('document.autorun supports the disposer pattern', () => {
    const o = new Observable<number>(1);
    let count = 0;
    const dispose = document.autorun(() => { o.get(); count++; });
    expect(count).toBe(1);
    o.set(2);
    expect(count).toBe(2);
    dispose();
    o.set(3);
    expect(count).toBe(2);
  });
});
