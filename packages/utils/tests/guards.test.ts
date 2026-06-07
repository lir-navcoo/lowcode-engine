import { describe, it, expect } from 'vitest';
import {
  isJSONValue,
  isNodeSchema,
  isRootSchema,
  isNodeData,
  isComponentSchema,
  isFieldConfig,
  isEventConfig,
  isActionContent,
  isDataSource,
} from '../src/guards';

describe('isJSONValue', () => {
  it('accepts primitives, arrays, and plain objects', () => {
    expect(isJSONValue('s')).toBe(true);
    expect(isJSONValue(1)).toBe(true);
    expect(isJSONValue(true)).toBe(true);
    expect(isJSONValue(null)).toBe(true);
    expect(isJSONValue([])).toBe(true);
    expect(isJSONValue([1, 'a', null])).toBe(true);
    expect(isJSONValue({})).toBe(true);
    expect(isJSONValue({ a: 1, b: [1, 2] })).toBe(true);
  });
  it('rejects non-JSON values', () => {
    expect(isJSONValue(undefined)).toBe(false);
    expect(isJSONValue(() => undefined)).toBe(false);
    expect(isJSONValue(new Date())).toBe(false);
    expect(isJSONValue({ a: undefined })).toBe(false);
    expect(isJSONValue({ a: () => undefined })).toBe(false);
  });
});

describe('isNodeSchema', () => {
  it('accepts node-shaped objects', () => {
    expect(isNodeSchema({ componentName: 'Button' })).toBe(true);
    expect(isNodeSchema({ componentName: 'Page', children: [] })).toBe(true);
  });
  it('rejects non-node shapes', () => {
    expect(isNodeSchema({})).toBe(false);
    expect(isNodeSchema({ componentName: 42 })).toBe(false);
    expect(isNodeSchema(null)).toBe(false);
    expect(isNodeSchema([])).toBe(false);
  });
});

describe('isRootSchema', () => {
  it('accepts root schemas (with fileName)', () => {
    expect(isRootSchema({ componentName: 'Page', fileName: 'home.json' })).toBe(true);
  });
  it('rejects nodes without fileName', () => {
    expect(isRootSchema({ componentName: 'Page' })).toBe(false);
  });
});

describe('isNodeData', () => {
  it('accepts the three variants', () => {
    expect(isNodeData({ type: 'literal', value: 1 })).toBe(true);
    expect(isNodeData({ type: 'expression', value: 'this.x' })).toBe(true);
    expect(isNodeData({ type: 'binding', value: 'state.x' })).toBe(true);
  });
  it('rejects unknown variants', () => {
    expect(isNodeData({ type: 'unknown' })).toBe(false);
    expect(isNodeData({})).toBe(false);
  });
});

describe('isComponentSchema', () => {
  it('accepts component meta', () => {
    expect(isComponentSchema({ componentName: 'Button', title: 'B' })).toBe(true);
  });
  it('rejects if title is missing', () => {
    expect(isComponentSchema({ componentName: 'Button' })).toBe(false);
  });
});

describe('isFieldConfig / isEventConfig / isActionContent / isDataSource', () => {
  it('isFieldConfig requires name+title+setter', () => {
    expect(isFieldConfig({ name: 'x', title: 'X', setter: 'Input' })).toBe(true);
    expect(isFieldConfig({ name: 'x', title: 'X' })).toBe(false);
  });
  it('isEventConfig requires name+title', () => {
    expect(isEventConfig({ name: 'onClick', title: 'Click' })).toBe(true);
    expect(isEventConfig({ name: 'onClick' })).toBe(false);
  });
  it('isActionContent accepts the three action types', () => {
    expect(isActionContent({ type: 'method', value: 'm' })).toBe(true);
    expect(isActionContent({ type: 'link', value: 'url' })).toBe(true);
    expect(isActionContent({ type: 'script', value: '...' })).toBe(true);
    expect(isActionContent({ type: 'other' })).toBe(false);
  });
  it('isDataSource requires id+handler', () => {
    expect(isDataSource({ id: 'a', handler: 'fetch' })).toBe(true);
    expect(isDataSource({ id: 'a' })).toBe(false);
  });
});
