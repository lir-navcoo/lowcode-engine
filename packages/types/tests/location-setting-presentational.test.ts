/**
 * @monbolc/lowcode-types — 新增 slim 类型端口的类型层断言
 *
 * 上游参考: `alibaba/lowcode-engine` v1.3.2
 *
 * 范围: location / setting / presentational / workspace 四个新文件
 * 的导出 + 关键签名。
 *
 * 这些断言是"占位 + 编译触发器":真正的保障是 `yarn typecheck`
 * 在 CI 跑;本文件只确保 4 个新模块被消费时**不会**因为导出
 * 漏掉而出现 import 解析失败。
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Types from '../src/index';

const SRC_DIR = path.join(__dirname, '..', 'src');

function readSrc(name: string): string {
  return fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
}

describe('location 模块', () => {
  it('source declares 4 export names (enum + 3 interfaces/types)', () => {
    const src = readSrc('location.ts');
    const expected = [
      'IPublicTypeLocationDetailType',
      'IPublicTypeLocationChildrenDetail',
      'IPublicTypeLocationPropDetail',
      'IPublicTypeLocationDetail',
      'IPublicTypeLocationData',
    ];
    const missing = expected.filter(
      (n) => !new RegExp(`export\\s+(type|interface|enum)\\s+${n}\\b`).test(src),
    );
    expect(missing, `types not exported: ${missing.join(', ')}`).toEqual([]);
  });

  it('IPublicTypeLocationData is generic + target uses IPublicTypeNodeLike', () => {
    // 编译触发 + 类型形状断言。
    const node: Types.IPublicTypeNodeLike = { id: 'l1', componentName: 'Div' };
    const data: Types.IPublicTypeLocationData = {
      target: node,
      detail: { type: Types.IPublicTypeLocationDetailType.Children, index: 0, valid: true },
      source: 'palette',
      event: undefined,
    };
    expect(data.target.id).toBe('l1');
    expect(data.detail.type).toBe('Children');
  });

  it('IPublicTypeLocationDetailType enum has both Children + Prop', () => {
    // enum 在运行时是对象;断言两个值都在。
    expect(Types.IPublicTypeLocationDetailType.Children).toBe('Children');
    expect(Types.IPublicTypeLocationDetailType.Prop).toBe('Prop');
  });
});

describe('setting 模块', () => {
  it('source declares command + hotkey types', () => {
    const src = readSrc('setting.ts');
    const expected = [
      'IPublicTypeCommandHandlerArgs',
      'IPublicTypeCommandParameter',
      'IPublicTypeCommand',
      'IPublicTypeHotkeyCallback',
      'IPublicTypeHotkeyCallbackConfig',
    ];
    const missing = expected.filter(
      (n) => !new RegExp(`export\\s+(type|interface)\\s+${n}\\b`).test(src),
    );
    expect(missing, `types not exported: ${missing.join(', ')}`).toEqual([]);
  });

  it('IPublicTypeCommand accepts minimal {name + handler} shape', () => {
    const cmd: Types.IPublicTypeCommand = {
      name: 'designer.remove',
      handler: (_args) => { /* no-op */ },
    };
    expect(cmd.name).toBe('designer.remove');
  });

  it('IPublicTypeHotkeyCallbackConfig binds a keyboard combo', () => {
    const cfg: Types.IPublicTypeHotkeyCallbackConfig = {
      callback: (_e) => false,
      modifiers: ['ctrl'],
      action: 'doc.save',
      combo: 'ctrl+s',
      level: 0,
    };
    expect(cfg.combo).toBe('ctrl+s');
    expect(cfg.modifiers).toContain('ctrl');
  });
});

describe('presentational 模块', () => {
  it('source declares i18n-data + title + icon types', () => {
    const src = readSrc('presentational.ts');
    const expected = [
      'IPublicTypeI18nData',
      'IPublicTypeIconConfig',
      'IPublicTypeIconType',
      'IPublicTypeTitleConfig',
      'IPublicTypeTitleContent',
    ];
    const missing = expected.filter(
      (n) => !new RegExp(`export\\s+(type|interface)\\s+${n}\\b`).test(src),
    );
    expect(missing, `types not exported: ${missing.join(', ')}`).toEqual([]);
  });

  it('IPublicTypeI18nData has the type=i18n discriminator', () => {
    const data: Types.IPublicTypeI18nData = { type: 'i18n', intl: 'Save' };
    expect(data.type).toBe('i18n');
  });

  it('IPublicTypeIconConfig accepts size preset + className', () => {
    const cfg: Types.IPublicTypeIconConfig = { type: 'save', size: 'medium', className: 'mr-2' };
    expect(cfg.size).toBe('medium');
  });

  it('IPublicTypeTitleConfig bundles label + icon + tip', () => {
    const tc: Types.IPublicTypeTitleConfig = {
      label: 'Save',
      tip: 'Save the document',
      icon: { type: 'save', size: 16 },
      docUrl: 'https://example.com/docs/save',
    };
    expect(tc.label).toBe('Save');
  });

  it('IPublicTypeIconType union accepts string / config / unknown', () => {
    // 三个分支都能赋给联合类型 —— 编译时窄化。
    const a: Types.IPublicTypeIconType = 'https://example.com/icon.svg';
    const b: Types.IPublicTypeIconType = { type: 'save' };
    const c: Types.IPublicTypeIconType = undefined; // 上游的 ReactElement/ComponentType 在 sapu 用 unknown
    expect(a).toContain('://');
    expect((b as Types.IPublicTypeIconConfig).type).toBe('save');
    expect(c).toBeUndefined();
  });
});

describe('workspace 模块', () => {
  it('source declares resource type + config types', () => {
    const src = readSrc('workspace.ts');
    const expected = ['IPublicTypeResourceType', 'IPublicResourceTypeConfig'];
    const missing = expected.filter(
      (n) => !new RegExp(`export\\s+(type|interface)\\s+${n}\\b`).test(src),
    );
    expect(missing, `types not exported: ${missing.join(', ')}`).toEqual([]);
  });

  it('IPublicTypeResourceType signature accepts (ctx, options) call', () => {
    // 上游的接口是可调用签名;sapu 保留。
    const factory: Types.IPublicTypeResourceType = (() => {
      const f = ((_ctx: unknown, _options: Record<string, unknown>) => ({
        defaultViewName: 'main',
        editorViews: [],
      })) as unknown as Types.IPublicTypeResourceType;
      f.resourceName = 'demo';
      f.resourceType = 'editor';
      return f;
    })();
    const result = factory({}, {});
    expect(result.defaultViewName).toBe('main');
    expect(factory.resourceType).toBe('editor');
  });
});

describe('barrel index.ts exports the 4 new modules', () => {
  it('index.ts re-exports location / setting / presentational / workspace', () => {
    const src = readSrc('index.ts');
    const expected = [
      "export * from './location';",
      "export * from './setting';",
      "export * from './presentational';",
      "export * from './workspace';",
    ];
    const missing = expected.filter((e) => !src.includes(e));
    expect(missing, `barrel re-exports missing: ${missing.join(', ')}`).toEqual([]);
  });
});
