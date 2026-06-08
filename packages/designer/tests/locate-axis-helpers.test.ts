/**
 * @monbolc/lowcode-designer — Phase C.Z ali-mirror tests
 * locate.ts axis helpers
 *
 * Per `~/.claude/plans/dynamic-marinating-rabbit.md` Phase C. Ali-faithful
 * port of `alibaba/lowcode-engine/packages/designer/src/designer/location.ts:40-99`.
 * The 4 helpers decide the drop-target's insert axis (H vs V)
 * based on `getComputedStyle` of the container / child.
 *
 * **Test-only window stub**: happy-dom's `getComputedStyle` does
 * not return inline-set values reliably. The ali-faithful
 * implementation goes through `(win || getWindow(container)).getComputedStyle(el)`,
 * so the test helper builds a fake `Window` per element with a
 * controlled `getComputedStyle` and passes it as the optional
 * 2nd argument to `isRowContainer(el, win?)` / `isChildInline(el, win?)`.
 */
import { describe, it, expect } from 'vitest';
import { isRowContainer, isChildInline, isVerticalContainer, isVertical } from '../src/locate';
import type { IPublicTypeRect } from '../src/simulator-host';

/** Build a div with the given inline style + a matching fake
 *  `Window` whose `getComputedStyle(el)` returns the dict. */
function mkEl(style: Partial<CSSStyleDeclaration>): { el: HTMLDivElement; win: Window } {
  const el = document.createElement('div');
  Object.entries(style).forEach(([k, v]) => {
    (el.style as unknown as Record<string, string>)[k] = String(v);
  });
  const dict: Record<string, string> = {};
  for (const [k, v] of Object.entries(style)) {
    if (typeof v === 'string') dict[k] = v;
  }
  const win = {
    getComputedStyle(_el: Element): CSSStyleDeclaration {
      return {
        getPropertyValue(name: string): string {
          // Convert kebab-case lookup to camelCase dict key
          // (e.g. "flex-direction" → "flexDirection").
          const camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
          return dict[camel] ?? dict[name] ?? '';
        },
      } as unknown as CSSStyleDeclaration;
    },
  } as unknown as Window;
  return { el, win };
}

/** Build an `IPublicTypeRect` pointing at a single element. */
function mkRect(el: Element): IPublicTypeRect {
  const rect = new DOMRect(0, 0, 100, 50) as IPublicTypeRect;
  rect.elements = [el];
  return rect;
}

describe('isRowContainer (Phase C.Z ali-mirror)', () => {
  it('flex row → true', () => {
    const { el, win } = mkEl({ display: 'flex', flexDirection: 'row' });
    expect(isRowContainer(el, win)).toBe(true);
  });

  it('flex row-reverse → true', () => {
    const { el, win } = mkEl({ display: 'flex', flexDirection: 'row-reverse' });
    expect(isRowContainer(el, win)).toBe(true);
  });

  it('flex column → false', () => {
    const { el, win } = mkEl({ display: 'flex', flexDirection: 'column' });
    expect(isRowContainer(el, win)).toBe(false);
  });

  it('flex column-reverse → false', () => {
    const { el, win } = mkEl({ display: 'flex', flexDirection: 'column-reverse' });
    expect(isRowContainer(el, win)).toBe(false);
  });

  it('inline-flex (row) → true', () => {
    const { el, win } = mkEl({ display: 'inline-flex', flexDirection: 'row' });
    expect(isRowContainer(el, win)).toBe(true);
  });

  it('grid → true', () => {
    const { el, win } = mkEl({ display: 'grid' });
    expect(isRowContainer(el, win)).toBe(true);
  });

  it('inline-grid → true', () => {
    const { el, win } = mkEl({ display: 'inline-grid' });
    expect(isRowContainer(el, win)).toBe(true);
  });

  it('block → false', () => {
    const { el, win } = mkEl({ display: 'block' });
    expect(isRowContainer(el, win)).toBe(false);
  });

  it('inline-block → false (only `display: inline*` matches isChildInline)', () => {
    const { el, win } = mkEl({ display: 'inline-block' });
    expect(isRowContainer(el, win)).toBe(false);
  });

  it('Text node → true (always inline flow)', () => {
    const t = document.createTextNode('hello');
    expect(isRowContainer(t)).toBe(true);
  });
});

describe('isChildInline (Phase C.Z ali-mirror)', () => {
  it('display: inline → true', () => {
    const { el, win } = mkEl({ display: 'inline' });
    expect(isChildInline(el, win)).toBe(true);
  });

  it('display: inline-block → true', () => {
    const { el, win } = mkEl({ display: 'inline-block' });
    expect(isChildInline(el, win)).toBe(true);
  });

  it('display: inline-flex → true', () => {
    const { el, win } = mkEl({ display: 'inline-flex' });
    expect(isChildInline(el, win)).toBe(true);
  });

  it('display: block → false', () => {
    const { el, win } = mkEl({ display: 'block' });
    expect(isChildInline(el, win)).toBe(false);
  });

  it('display: flex → false', () => {
    const { el, win } = mkEl({ display: 'flex' });
    expect(isChildInline(el, win)).toBe(false);
  });

  it('float: left → true (floats are out-of-flow like inline)', () => {
    const { el, win } = mkEl({ display: 'block', float: 'left' });
    expect(isChildInline(el, win)).toBe(true);
  });

  it('float: right → true', () => {
    const { el, win } = mkEl({ display: 'block', float: 'right' });
    expect(isChildInline(el, win)).toBe(true);
  });

  it('float: none → false', () => {
    const { el, win } = mkEl({ display: 'block', float: 'none' });
    expect(isChildInline(el, win)).toBe(false);
  });

  it('Text node → true', () => {
    const t = document.createTextNode('hi');
    expect(isChildInline(t)).toBe(true);
  });
});

describe('isVerticalContainer (Phase C.Z ali-mirror)', () => {
  it('rect with row container → true (ali-faithful; name is "is vertical" because drop axis flips to V)', () => {
    const { el, win } = mkEl({ display: 'flex', flexDirection: 'row' });
    // isVerticalContainer does NOT take a win arg — it uses the
    // rect's element's ownerDocument's defaultView, which works
    // in happy-dom for the default 'block' display. Patch the
    // element's getComputedStyle path the same way:
    (el.ownerDocument!.defaultView as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle = () => ({
      getPropertyValue(name: string): string {
        if (name === 'display') return 'flex';
        if (name === 'flex-direction') return 'row';
        return '';
      },
    } as unknown as CSSStyleDeclaration);
    void win; // win kept for symmetry
    expect(isVerticalContainer(mkRect(el))).toBe(true);
  });

  it('rect with column container → false', () => {
    const { el } = mkEl({ display: 'flex', flexDirection: 'column' });
    (el.ownerDocument!.defaultView as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle = () => ({
      getPropertyValue(name: string): string {
        if (name === 'display') return 'flex';
        if (name === 'flex-direction') return 'column';
        return '';
      },
    } as unknown as CSSStyleDeclaration);
    expect(isVerticalContainer(mkRect(el))).toBe(false);
  });

  it('rect with grid → true (grid is a row layout in our model)', () => {
    const { el } = mkEl({ display: 'grid' });
    (el.ownerDocument!.defaultView as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle = () => ({
      getPropertyValue(name: string): string {
        if (name === 'display') return 'grid';
        return '';
      },
    } as unknown as CSSStyleDeclaration);
    expect(isVerticalContainer(mkRect(el))).toBe(true);
  });

  it('null rect → false', () => {
    expect(isVerticalContainer(null)).toBe(false);
  });

  it('rect with no elements → false', () => {
    const r = new DOMRect(0, 0, 10, 10) as IPublicTypeRect;
    r.elements = [];
    expect(isVerticalContainer(r)).toBe(false);
  });

  it('rect with computed:true (union) → false (cannot decide axis from a union)', () => {
    const { el } = mkEl({ display: 'flex', flexDirection: 'row' });
    const r = mkRect(el);
    r.computed = true;
    expect(isVerticalContainer(r)).toBe(false);
  });
});

describe('isVertical (Phase C.Z ali-mirror)', () => {
  it('inline child → true (H axis from child perspective)', () => {
    const { el } = mkEl({ display: 'inline' });
    (el.ownerDocument!.defaultView as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle = () => ({
      getPropertyValue(name: string): string {
        if (name === 'display') return 'inline';
        return '';
      },
    } as unknown as CSSStyleDeclaration);
    expect(isVertical(mkRect(el))).toBe(true);
  });

  it('Text child → true', () => {
    const t = document.createTextNode('x');
    expect(isVertical(mkRect(t))).toBe(true);
  });

  it('block child in a row container parent → true (parent decides H axis)', () => {
    const parent = mkEl({ display: 'flex', flexDirection: 'row' });
    const child = mkEl({ display: 'block' });
    parent.el.appendChild(child.el);
    (child.el.ownerDocument!.defaultView as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle = (e: Element) => {
      // For child: display:block. For parent: display:flex, flex-direction:row.
      if (e === parent.el) {
        return {
          getPropertyValue(name: string): string {
            if (name === 'display') return 'flex';
            if (name === 'flex-direction') return 'row';
            return '';
          },
        } as unknown as CSSStyleDeclaration;
      }
      return {
        getPropertyValue(name: string): string {
          if (name === 'display') return 'block';
          return '';
        },
      } as unknown as CSSStyleDeclaration;
    };
    expect(isVertical(mkRect(child.el))).toBe(true);
  });

  it('block child in a block container parent → false', () => {
    const parent = mkEl({ display: 'block' });
    const child = mkEl({ display: 'block' });
    parent.el.appendChild(child.el);
    (child.el.ownerDocument!.defaultView as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle = () => ({
      getPropertyValue(_name: string): string {
        return 'block';
      },
    } as unknown as CSSStyleDeclaration);
    expect(isVertical(mkRect(child.el))).toBe(false);
  });

  it('block child with NO parent → false (no parent to consult)', () => {
    const child = mkEl({ display: 'block' });
    // document.body might be a parent; force a detached element.
    expect(isVertical(mkRect(child.el))).toBe(false);
  });

  it('null rect → false', () => {
    expect(isVertical(null)).toBe(false);
  });

  it('computed:true rect → false (cannot decide axis from a union)', () => {
    const { el } = mkEl({ display: 'inline' });
    const r = mkRect(el);
    r.computed = true;
    expect(isVertical(r)).toBe(false);
  });

  it('float: left block child → true (float counts as inline)', () => {
    const { el } = mkEl({ display: 'block', float: 'left' });
    (el.ownerDocument!.defaultView as unknown as { getComputedStyle: (e: Element) => CSSStyleDeclaration }).getComputedStyle = () => ({
      getPropertyValue(name: string): string {
        if (name === 'display') return 'block';
        if (name === 'float') return 'left';
        return '';
      },
    } as unknown as CSSStyleDeclaration);
    expect(isVertical(mkRect(el))).toBe(true);
  });
});
