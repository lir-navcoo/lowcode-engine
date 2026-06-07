/**
 * Type-shape tests. We use a small runtime check to confirm the
 * types are exported and the file compiles. The real value here
 * is that the file's existence in the test suite forces a
 * typecheck that catches signature regressions.
 */
import { describe, it, expect } from 'vitest';
import * as Types from '../src/index';

describe('@monbolc/lowcode-types exports', () => {
  it('source file declares the 30+ core type names', () => {
    // We can't check type-only exports at runtime (they're erased
    // by the compiler), but we can read the source file and count
    // the unique `export type` / `export interface` declarations.
    // This catches regressions where a type is accidentally removed
    // and downstream consumers fail to compile.
    const fs = require('node:fs');
    const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'src', 'index.ts'), 'utf8');
    const expected = [
      'ID', 'Label', 'JSONValue', 'Unknown',
      'IPublicTypeNodeSchema', 'IPublicTypeNodeData', 'IPublicTypeRootSchema',
      'IPublicTypeComponentSchema', 'IPublicTypeNestingRule',
      'IPublicTypeComponentConfigure', 'IPublicTypeFieldConfig',
      'IPublicTypeSetterConfig', 'IPublicTypeEventConfig',
      'IPublicTypeAdvancedConfig', 'IPublicTypeSlotConfig',
      'IPublicTypeActionContent', 'IPublicTypeDataSource',
      'IPublicTypeI18nMessage',
      'IPublicEngineOptions', 'IPublicApiEngine', 'IPublicApiDesigner',
      'IPublicTypeStyle', 'IPublicTypeBreakpoint', 'IPublicTypeResponsiveStyle',
      'IPublicTypeAsset',
      'IPublicTypeProjectSchema', 'IPublicTypeProjectConfig',
      'IPublicTypeComponentCategory',
      'IPublicTypeCallback', 'IPublicTypeDisposable', 'IPublicTypeResult',
      'IPublicTypeClass',
    ];
    const missing = expected.filter(
      (n) => !new RegExp(`\\b(export\\s+(type|interface)\\s+${n}\\b|export\\s+type\\s+\\{[^}]*\\b${n}\\b)`).test(src),
    );
    expect(missing, `types not exported: ${missing.join(', ')}`).toEqual([]);
    expect(expected.length).toBeGreaterThanOrEqual(30);
  });

  it('JSONValue accepts a sample of valid values', () => {
    // Type-level assertion. If JSONValue regresses this file fails to compile.
    const v: Types.JSONValue = {
      s: 'hello',
      n: 42,
      b: true,
      nl: null,
      arr: [1, 'two', { three: 3 }],
    };
    expect(v).toBeDefined();
  });
});
