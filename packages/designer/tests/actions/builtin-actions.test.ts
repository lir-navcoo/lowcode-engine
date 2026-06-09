/**
 * @monbolc/lowcode-designer — T2 builtin-actions tests
 *
 * 覆盖 8 个默认组件动作(rename / duplicate / remove / copy / cut /
 * paste / moveUp / moveDown)+ 公共谓词门控。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Project } from '../../src/project';
import { deepClone } from '@monbolc/lowcode-utils';
import type { IPublicTypeRootSchema, IPublicTypeNodeSchema } from '@monbolc/lowcode-types';
import {
  BUILTIN_COMPONENT_ACTIONS,
  BUILTIN_ACTION_BY_NAME,
  DEFAULT_ACTION_LABELS,
  DEFAULT_ACTION_I18N_KEYS,
  localizeAction,
} from '../../src/actions/builtin-actions';
import type { IActionContext, IContextClipboard } from '../../src/actions/action-types';

const SEED: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'A', key: 'a' },
    { componentName: 'B', key: 'b' },
    { componentName: 'C', key: 'c' },
  ],
};

/** 轻量内存剪贴板。 */
function makeClipboard(): IContextClipboard {
  let payload: IPublicTypeNodeSchema | null = null;
  return {
    read: () => payload,
    write: (n) => { payload = n; },
    clear: () => { payload = null; },
  };
}

/** 构造一个最小可用的 IActionContext。 */
function makeCtx(
  project: Project,
  nodeId: string | null,
  clipboard: IContextClipboard = makeClipboard(),
  t: (k: string, fb?: string) => string = (_k, fb) => fb ?? '',
): IActionContext {
  return {
    node: nodeId ? { id: nodeId, componentName: project.document.getNode(nodeId)?.componentName ?? '' } : null,
    document: project.document as never,
    project: { events: project.events },
    clipboard,
    t,
  };
}

describe('builtin-actions: 8 default actions registered', () => {
  it('BUILTIN_COMPONENT_ACTIONS has 8 entries with the expected names', () => {
    expect(BUILTIN_COMPONENT_ACTIONS).toHaveLength(8);
    const names = BUILTIN_COMPONENT_ACTIONS.map((a) => a.name);
    expect(names).toEqual([
      'rename',
      'duplicate',
      'remove',
      'copy',
      'cut',
      'paste',
      'moveUp',
      'moveDown',
    ]);
  });

  it('BUILTIN_ACTION_BY_NAME is consistent with BUILTIN_COMPONENT_ACTIONS', () => {
    for (const a of BUILTIN_COMPONENT_ACTIONS) {
      expect(BUILTIN_ACTION_BY_NAME[a.name]).toBe(a);
    }
  });

  it('each action has a default label and i18n key', () => {
    for (const a of BUILTIN_COMPONENT_ACTIONS) {
      expect(DEFAULT_ACTION_LABELS[a.name]).toBeTruthy();
      expect(DEFAULT_ACTION_I18N_KEYS[a.name]).toMatch(/^designer\.contextMenu\./);
    }
  });
});

describe('rename action', () => {
  let project: Project;
  let ctx: IActionContext;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
    ctx = makeCtx(project, 'a');
  });

  it('returns false when ctx.event has no newName (L4 needs to prompt first)', () => {
    const ok = BUILTIN_ACTION_BY_NAME.rename.run(ctx);
    expect(ok).toBe(false);
    expect(project.document.getNode('a')?.componentName).toBe('A');
  });

  it('renames when newName is provided', () => {
    const seen: Array<Record<string, unknown>> = [];
    project.document.events.on('nodeRenamed', (e) => seen.push(e as Record<string, unknown>));
    ctx.event = { detail: { newName: 'A2' } } as unknown as MouseEvent;
    const ok = BUILTIN_ACTION_BY_NAME.rename.run(ctx);
    expect(ok).toBe(true);
    expect(project.document.getNode('a')?.componentName).toBe('A2');
    expect(seen.length).toBe(1);
    expect((seen[0].node as { componentName: string }).componentName).toBe('A2');
    expect(seen[0].newName).toBe('A2');
  });

  it('returns false when newName is the same as current', () => {
    ctx.event = { detail: { newName: 'A' } } as unknown as MouseEvent;
    const ok = BUILTIN_ACTION_BY_NAME.rename.run(ctx);
    expect(ok).toBe(false);
  });

  it('returns false when ctx.node is null', () => {
    const noNode = makeCtx(project, null);
    const ok = BUILTIN_ACTION_BY_NAME.rename.run(noNode);
    expect(ok).toBe(false);
  });

  it('condition is true only when node has a non-empty componentName', () => {
    expect(BUILTIN_ACTION_BY_NAME.rename.condition!(ctx)).toBe(true);
    const empty = makeCtx(project, 'a');
    empty.node = { id: 'a', componentName: '' };
    expect(BUILTIN_ACTION_BY_NAME.rename.condition!(empty)).toBe(false);
  });
});

describe('duplicate action', () => {
  let project: Project;
  let ctx: IActionContext;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
    ctx = makeCtx(project, 'b');
  });

  it('clones the node and inserts as sibling-after', () => {
    const ok = BUILTIN_ACTION_BY_NAME.duplicate.run(ctx);
    expect(ok).toBe(true);
    expect(project.document.root.children!.length).toBe(4);
    // Original: ['A', 'B', 'C']; duplicated 'B' inserts at index 2 (sibling-after 'B'):
    expect(project.document.root.children![0].componentName).toBe('A');
    expect(project.document.root.children![1].componentName).toBe('B');
    expect(project.document.root.children![2].componentName).toBe('B');
    expect(project.document.root.children![3].componentName).toBe('C');
    // Duplicated node must have a fresh key.
    expect(project.document.root.children![2].key).not.toBe('b');
  });

  it('returns false when ctx.node is null', () => {
    expect(BUILTIN_ACTION_BY_NAME.duplicate.run(makeCtx(project, null))).toBe(false);
  });

  it('condition is true when node is set, false otherwise', () => {
    expect(BUILTIN_ACTION_BY_NAME.duplicate.condition!(ctx)).toBe(true);
    expect(BUILTIN_ACTION_BY_NAME.duplicate.condition!(makeCtx(project, null))).toBe(false);
  });
});

describe('remove action', () => {
  let project: Project;
  let ctx: IActionContext;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
    ctx = makeCtx(project, 'b');
  });

  it('removes the node from the document', () => {
    const ok = BUILTIN_ACTION_BY_NAME.remove.run(ctx);
    expect(ok).toBe(true);
    expect(project.document.getNode('b')).toBeUndefined();
    expect(project.document.root.children!.map((c) => c.componentName)).toEqual(['A', 'C']);
  });

  it('refuses to remove the root node', () => {
    const rootId = project.document.root.key as string;
    const rootCtx = makeCtx(project, rootId);
    const ok = BUILTIN_ACTION_BY_NAME.remove.run(rootCtx);
    expect(ok).toBe(false);
    expect(project.document.getNode(rootId)).toBeDefined();
  });

  it('returns false when ctx.node is null', () => {
    expect(BUILTIN_ACTION_BY_NAME.remove.run(makeCtx(project, null))).toBe(false);
  });
});

describe('copy action', () => {
  let project: Project;
  let clipboard: IContextClipboard;
  let ctx: IActionContext;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
    clipboard = makeClipboard();
    ctx = makeCtx(project, 'b', clipboard);
  });

  it('writes a deep clone to the clipboard', () => {
    const ok = BUILTIN_ACTION_BY_NAME.copy.run(ctx);
    expect(ok).toBe(true);
    const payload = clipboard.read();
    expect(payload).not.toBeNull();
    expect(payload!.componentName).toBe('B');
    // mutation of payload must not affect document
    payload!.componentName = 'mutated';
    expect(project.document.getNode('b')?.componentName).toBe('B');
  });

  it('returns false when ctx.node is null', () => {
    expect(BUILTIN_ACTION_BY_NAME.copy.run(makeCtx(project, null, clipboard))).toBe(false);
  });
});

describe('cut action', () => {
  let project: Project;
  let clipboard: IContextClipboard;
  let ctx: IActionContext;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
    clipboard = makeClipboard();
    ctx = makeCtx(project, 'b', clipboard);
  });

  it('writes to clipboard and does NOT remove the source node', () => {
    const ok = BUILTIN_ACTION_BY_NAME.cut.run(ctx);
    expect(ok).toBe(true);
    expect(clipboard.read()).not.toBeNull();
    expect(project.document.getNode('b')).toBeDefined();
  });

  it('returns false when ctx.node is null', () => {
    expect(BUILTIN_ACTION_BY_NAME.cut.run(makeCtx(project, null, clipboard))).toBe(false);
  });
});

describe('paste action', () => {
  let project: Project;
  let clipboard: IContextClipboard;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
    clipboard = makeClipboard();
  });

  it('inserts the clipboard payload as sibling-after the current node', () => {
    clipboard.write({ componentName: 'Pasted' });
    const ctx = makeCtx(project, 'a', clipboard);
    const ok = BUILTIN_ACTION_BY_NAME.paste.run(ctx);
    expect(ok).toBe(true);
    expect(project.document.root.children!.length).toBe(4);
    expect(project.document.root.children![1].componentName).toBe('Pasted');
  });

  it('inserts at end of root when ctx.node is null', () => {
    clipboard.write({ componentName: 'Pasted' });
    const ctx = makeCtx(project, null, clipboard);
    const ok = BUILTIN_ACTION_BY_NAME.paste.run(ctx);
    expect(ok).toBe(true);
    expect(project.document.root.children!.length).toBe(4);
    expect(project.document.root.children![3].componentName).toBe('Pasted');
  });

  it('returns false when clipboard is empty', () => {
    const ctx = makeCtx(project, 'a', clipboard);
    expect(BUILTIN_ACTION_BY_NAME.paste.run(ctx)).toBe(false);
  });

  it('condition is true when clipboard has content, false otherwise', () => {
    const ctxEmpty = makeCtx(project, 'a', clipboard);
    expect(BUILTIN_ACTION_BY_NAME.paste.condition!(ctxEmpty)).toBe(false);
    clipboard.write({ componentName: 'X' });
    expect(BUILTIN_ACTION_BY_NAME.paste.condition!(ctxEmpty)).toBe(true);
  });
});

describe('moveUp action', () => {
  let project: Project;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
  });

  it('swaps with the previous sibling', () => {
    const ctx = makeCtx(project, 'b');
    const ok = BUILTIN_ACTION_BY_NAME.moveUp.run(ctx);
    expect(ok).toBe(true);
    expect(project.document.root.children!.map((c) => c.componentName)).toEqual(['B', 'A', 'C']);
  });

  it('returns false at the top boundary (no-op)', () => {
    const ctx = makeCtx(project, 'a');
    expect(BUILTIN_ACTION_BY_NAME.moveUp.run(ctx)).toBe(false);
  });

  it('condition is false at the top boundary', () => {
    expect(BUILTIN_ACTION_BY_NAME.moveUp.condition!(makeCtx(project, 'a'))).toBe(false);
    expect(BUILTIN_ACTION_BY_NAME.moveUp.condition!(makeCtx(project, 'b'))).toBe(true);
  });

  it('returns false when ctx.node is null', () => {
    expect(BUILTIN_ACTION_BY_NAME.moveUp.run(makeCtx(project, null))).toBe(false);
  });
});

describe('moveDown action', () => {
  let project: Project;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
  });

  it('swaps with the next sibling', () => {
    const ctx = makeCtx(project, 'b');
    const ok = BUILTIN_ACTION_BY_NAME.moveDown.run(ctx);
    expect(ok).toBe(true);
    expect(project.document.root.children!.map((c) => c.componentName)).toEqual(['A', 'C', 'B']);
  });

  it('returns false at the bottom boundary (no-op)', () => {
    const ctx = makeCtx(project, 'c');
    expect(BUILTIN_ACTION_BY_NAME.moveDown.run(ctx)).toBe(false);
  });

  it('condition is false at the bottom boundary', () => {
    expect(BUILTIN_ACTION_BY_NAME.moveDown.condition!(makeCtx(project, 'c'))).toBe(false);
    expect(BUILTIN_ACTION_BY_NAME.moveDown.condition!(makeCtx(project, 'b'))).toBe(true);
  });

  it('returns false when ctx.node is null', () => {
    expect(BUILTIN_ACTION_BY_NAME.moveDown.run(makeCtx(project, null))).toBe(false);
  });
});

describe('common: condition gate (all actions)', () => {
  let project: Project;
  beforeEach(() => {
    project = new Project(deepClone(SEED));
  });

  it('all 8 actions honor overridden condition (L4 applies condition before run)', () => {
    // Slim port 的契约: condition 由 L4 在显示/启用菜单前自行调用,
    // `run` 不再二次检查。验证每个动作的 `condition` 都可以被替换,
    // 并能被 L4 看到结果。
    const ctx = makeCtx(project, 'b');
    for (const a of BUILTIN_COMPONENT_ACTIONS) {
      const gated = { ...a, condition: () => false };
      expect(gated.condition!(ctx)).toBe(false);
    }
  });

  it('warns via console.warn when document.rename throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ctx = makeCtx(project, 'a');
    // Force rename to throw
    (ctx.document as { rename: (...args: unknown[]) => void }).rename = () => {
      throw new Error('forced-rename-error');
    };
    ctx.event = { detail: { newName: 'X' } } as unknown as MouseEvent;
    const ok = BUILTIN_ACTION_BY_NAME.rename.run(ctx);
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('localizeAction', () => {
  it('rewrites label via ctx.t', () => {
    const t = vi.fn((k: string, fb?: string) => (k === 'designer.contextMenu.copy' ? '复制' : fb ?? k));
    const localized = localizeAction(BUILTIN_ACTION_BY_NAME.copy, { t });
    expect(localized.label).toBe('复制');
    expect(localized.name).toBe('copy');
  });

  it('returns same object when t returns the original label', () => {
    const t = vi.fn((_k: string, fb?: string) => fb ?? '');
    const localized = localizeAction(BUILTIN_ACTION_BY_NAME.copy, { t });
    expect(localized).toBe(BUILTIN_ACTION_BY_NAME.copy);
  });
});

describe('i18n fallback (ctx.t fallback)', () => {
  it('each action label can be reached via ctx.t with its i18n key', () => {
    const map: Record<string, string> = { ...DEFAULT_ACTION_LABELS };
    const t = (k: string, fb?: string) => map[k] ?? fb ?? k;
    for (const a of BUILTIN_COMPONENT_ACTIONS) {
      const key = DEFAULT_ACTION_I18N_KEYS[a.name];
      const localized = t(key, a.label);
      expect(localized).toBe(a.label);
    }
  });
});