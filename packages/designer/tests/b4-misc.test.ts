/**
 * @monbolc/lowcode-designer — Phase B.4 tests (clickable + path + parse-metadata)
 */
import { describe, it, expect } from 'vitest';
import { getClosestClickableNode } from '../src/builtin-simulator/utils/clickable';
import {
  isPackagePath,
  toTitleCase,
  generateComponentName,
  getNormalizedImportPath,
  makeRelativePath,
  resolveAbsoluatePath,
  joinPath,
  removeVersion,
} from '../src/builtin-simulator/utils/path';
import {
  primitiveTypes,
  parseProps,
  parseMetadata,
} from '../src/builtin-simulator/utils/parse-metadata';

describe('clickable (Phase B.4)', () => {
  // Minimal tree-node shape ali-faithful.
  type N = { id: string; locked?: boolean; parent?: N | null };
  const mk = (id: string, locked = false): N => ({ id, locked });

  it('returns the node itself if clickable + no locked ancestor', () => {
    const root = mk('root');
    const child = { ...mk('child'), parent: root };
    const got = getClosestClickableNode<N>(child, () => true, (n) => !!n.locked, {} as MouseEvent);
    expect(got?.id).toBe('child');
  });

  it('skips a locked node + returns its parent', () => {
    const root = mk('root');
    const locked = { ...mk('locked', true), parent: root };
    const got = getClosestClickableNode<N>(locked, () => true, (n) => !!n.locked, {} as MouseEvent);
    expect(got?.id).toBe('root');
  });

  it('skips a node whose canClick returns false + walks up', () => {
    const root = mk('root');
    const child = { ...mk('child'), parent: root };
    let first = true;
    const got = getClosestClickableNode<N>(child, () => { if (first) { first = false; return false; } return true; }, (n) => !!n.locked, {} as MouseEvent);
    expect(got?.id).toBe('root');
  });

  it('returns undefined when nothing is clickable', () => {
    const root = mk('root', true);
    const child = { ...mk('child'), parent: root };
    const got = getClosestClickableNode<N>(child, () => false, (n) => !!n.locked, {} as MouseEvent);
    expect(got).toBeUndefined();
  });
});

describe('path utils (Phase B.4)', () => {
  it('isPackagePath: relative and absolute are NOT packages', () => {
    expect(isPackagePath('./foo')).toBe(false);
    expect(isPackagePath('/abs/foo')).toBe(false);
  });
  it('isPackagePath: bare names ARE packages', () => {
    expect(isPackagePath('lodash')).toBe(true);
    expect(isPackagePath('@scope/pkg')).toBe(true);
  });

  it('toTitleCase handles hyphens, underscores, spaces', () => {
    expect(toTitleCase('hello-world')).toBe('HelloWorld');
    expect(toTitleCase('foo_bar baz')).toBe('FooBarBaz');
  });

  it('generateComponentName: takes basename + title-cases', () => {
    expect(generateComponentName('src/components/Button.tsx')).toBe('Button');
    expect(generateComponentName('a/b/index.ts')).toBe('B');
    expect(generateComponentName('')).toBe('Component');
  });

  it('getNormalizedImportPath: strip .ts/.tsx + index', () => {
    expect(getNormalizedImportPath('dir/Header.tsx')).toBe('dir/Header');
    expect(getNormalizedImportPath('dir/index.ts')).toBe('dir');
    expect(getNormalizedImportPath('a/b/c.ts')).toBe('a/b/c');
  });

  it('makeRelativePath: same dir → ./x', () => {
    expect(makeRelativePath('/a/b/c', '/a/b')).toBe('./c');
  });

  it('makeRelativePath: deeper target → ../', () => {
    expect(makeRelativePath('/a/x', '/a/b/c')).toBe('../../x');
  });

  it('resolveAbsoluatePath: relative against base', () => {
    expect(resolveAbsoluatePath('./foo', '/a/b')).toBe('/a/b/foo');
    expect(resolveAbsoluatePath('../bar', '/a/b/c')).toBe('/a/bar');
  });

  it('resolveAbsoluatePath: package name passthrough', () => {
    expect(resolveAbsoluatePath('lodash', '/a')).toBe('lodash');
  });

  it('joinPath normalizes and skips empties', () => {
    expect(joinPath('a', '', 'b', 'c')).toBe('a/b/c');
    expect(joinPath('a/', '/b/')).toBe('a/b');
  });

  it('removeVersion strips @x.y.z from package paths', () => {
    expect(removeVersion('lodash@4.17.21/foo')).toBe('lodash/foo');
    expect(removeVersion('@scope/pkg@1.2.3')).toBe('@scope/pkg');
    expect(removeVersion('lodash')).toBe('lodash');
  });
});

describe('parse-metadata (Phase B.4)', () => {
  it('primitiveTypes includes the ali-faithful 10 entries', () => {
    expect(primitiveTypes).toContain('string');
    expect(primitiveTypes).toContain('number');
    expect(primitiveTypes).toContain('bool');
    expect(primitiveTypes).toContain('any');
    expect(primitiveTypes.length).toBe(10);
  });

  it('parseProps: empty component returns []', () => {
    expect(parseProps(null)).toEqual([]);
    expect(parseProps(undefined)).toEqual([]);
    expect(parseProps({})).toEqual([]);
  });

  it('parseProps: lowcodeType-annotated props are ali-faithful', () => {
    const Component = {
      propTypes: {
        name: { lowcodeType: 'string' },
        age: { lowcodeType: 'number' },
      },
      defaultProps: { name: 'foo', age: 0 },
    };
    const props = parseProps(Component);
    expect(props).toHaveLength(2);
    const byName = Object.fromEntries(props.map((p) => [p.name, p]));
    expect(byName.name).toEqual({ name: 'name', propType: 'string', defaultValue: 'foo' });
    expect(byName.age).toEqual({ name: 'age', propType: 'number', defaultValue: 0 });
  });

  it('parseProps: defaultProps not in propTypes get inferred type', () => {
    const Component = {
      propTypes: {},
      defaultProps: { count: 42, isActive: true, onClick: () => {} },
    };
    const props = parseProps(Component);
    const byName = Object.fromEntries(props.map((p) => [p.name, p]));
    expect(byName.count.propType).toBe('number');
    expect(byName.isActive.propType).toBe('bool');
    expect(byName.onClick.propType).toBe('func');
  });

  it('parseMetadata: returns props + spread componentMetadata', () => {
    const Component = {
      propTypes: { name: { lowcodeType: 'string' } },
      defaultProps: { name: 'foo' },
      componentMetadata: { title: 'My Component', category: 'ui' },
    };
    const meta = parseMetadata(Component);
    expect(meta.props).toHaveLength(1);
    expect(meta.title).toBe('My Component');
    expect(meta.category).toBe('ui');
  });
});
