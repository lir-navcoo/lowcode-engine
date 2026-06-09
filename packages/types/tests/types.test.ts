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
    const path = require('node:path');
    const srcDir = path.join(__dirname, '..', 'src');
    const src = fs.readdirSync(srcDir)
      .filter((name: string) => name.endsWith('.ts'))
      .map((name: string) => fs.readFileSync(path.join(srcDir, name), 'utf8'))
      .join('\n');
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
      'IPublicTypeProjectSchema', 'IPublicTypeProjectDocument', 'IPublicTypeLegacyProjectDocument', 'IPublicTypeProjectConfig',
      'IPublicTypeComponentCategory',
      'IPublicTypeComponentInstance', 'IPublicTypeComponentMetadata',
      'IPublicTypeJSExpression', 'IPublicTypeJSFunction', 'IPublicTypeJSBlock', 'IPublicTypeJSSlot',
      'IPublicTypePropConfig', 'IPublicTypePropType', 'IPublicTypePropTypes',
      'IPublicTypeConfigTransducer', 'IPublicTypeMetadataTransducer', 'IPublicTypePropsTransducer',
      'IPublicTypePlugin', 'IPublicTypePluginConfig', 'IPublicTypePluginMeta',
      'IPublicEnumContextMenuType', 'IPublicEnumDragObjectType', 'IPublicEnumPluginRegisterLevel', 'IPublicEnumTransformStage',
      'IPublicTypeActionContentObject', 'IPublicTypeEditorView', 'IPublicTypeEditorViewConfig',
      'IPublicTypeCallback', 'IPublicTypeDisposable', 'IPublicTypeResult',
      'IPublicTypeClass',
    ];
    const missing = expected.filter(
      (n) => !new RegExp(`\\b(export\\s+(type|interface|enum)\\s+${n}\\b|export\\s+type\\s+\\{[^}]*\\b${n}\\b)`).test(src),
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

  it('drag-and-drop public type surface compiles + has a Node + Boost + Any drag object', () => {
    // The real value is the typecheck: if any of the new drag types
    // regress (signature change, missing export), this file fails to
    // compile.
    const node: Types.IPublicTypeNodeLike = { id: 'n_1', componentName: 'Div' };
    const nodeDrag: Types.IPublicTypeDragObject = { type: 'Node', nodes: [node] };
    const boostDrag: Types.IPublicTypeDragObject = {
      type: 'NodeData',
      data: { componentName: 'Button', initialProps: { label: 'OK' } },
    };
    const anyDrag: Types.IPublicTypeDragObject = { type: 'Any', extra: { from: 'file' } };

    // Discriminator narrows the union.
    const kind: Array<'Node' | 'NodeData' | 'Any'> = [
      nodeDrag.type,
      boostDrag.type,
      anyDrag.type,
    ];
    expect(kind).toEqual(['Node', 'NodeData', 'Any']);
  });

  it('IPublicModelDragon is generic over TNode (compile-time check)', () => {
    // A custom node shape works with the generic interface — the
    // engine's IPublicTypeNodeSchema, the designer's internal Node,
    // and a host-defined type can all bind to the same Dragon.
    interface MyNode { id: string; componentName: string; customField: number }
    const myNode: MyNode = { id: 'm1', componentName: 'X', customField: 1 };
    // IPublicModelDragon<MyNode, ...> would be the engine.dragon
    // type for a host using MyNode. This declaration wouldn't
    // compile if the generic interface regressed.
    type _MyDragon = Types.IPublicModelDragon<MyNode>;
    const _phantom: _MyDragon | undefined = undefined;
    expect(_phantom).toBeUndefined();
    expect(myNode.customField).toBe(1);
  });
});
