# `@monbolc/lowcode-plugin-setters` (L2.5)

> **Version**: 2.3.0 · **BaseUI peer (required, MUST be used)** · **0 typecheck errors** · **53 tests / 2 files** · **Phase D.I7b.16 (unregisterSetter) done**

## Purpose

The setter registry. The upstream gets default setters from the **external** package `@alilc/lowcode-engine-ext` (not vendored in the open-source repo). Sapu ships its own setters in-repo, and per `feedback-react19-and-baseui` they **must** use BaseUI components.

Currently in flux: the typecheck is broken (8 errors) and the 7 built-in setters use raw `<input>` / `<button>` / `<select>` / `<textarea>` / `<input type="color|range">` HTML elements rather than BaseUI primitives — that violates the BaseUI directive.

## Public exports

### Registry (`registry.ts`)
- `registerSetter(name, component)` — register a named setter
- `unregisterSetter(name)` (D.I7b.16) — remove a previously-registered setter; returns `true` on first call (entry was present), `false` on second call (no-op)
- `hasSetter(name)` (D.I7b.16) — query whether a setter is registered
- `getSetter(name)` — look up a registered setter
- `pickSetter(field)` — pick a setter for a field config; falls back to `Input`
- `resolveSetterName(field)` — resolve the setter name from a field
- `withLabel(label, control)` — vertical label+control composition helper
- `BUILT_IN_SETTERS` — const array: `['Input', 'TextArea', 'Number', 'Switch', 'Select', 'ColorPicker', 'Slider']`
- Types: `SetterComponent`, `SetterProps`, `BuiltInSetter`

### Built-in setters (`built-in.tsx`)
- `registerBuiltInSetters()` — idempotent registration (guarded by `_registered` boolean)
- 7 setters: `Input`, `TextArea`, `Number`, `Switch`, `Select`, `ColorPicker`, `Slider`

## Key types

```ts
interface SetterProps {
  value: JSONValue;
  field: IPublicTypeFieldConfig;
  onChange: (v: JSONValue) => void;
  onInput?: (v: JSONValue) => void;
}

// Hyperscript descriptor — what setters actually return.
// `type` is a string that the L4 settings panel resolves to a BaseUI component
// (e.g. 'Field' → BaseUIField, 'Switch' → BaseUISwitch).
type SetterComponent = (props: SetterProps) => {
  type: string;         // BaseUI component name
  props: Record<string, unknown>;
  children?: unknown;
};
```

## Implementation patterns

- **Each setter returns a hyperscript descriptor `{ type, props, children? }`.** The L4 settings panel converts the descriptor into a real BaseUI element via `adapter.getRuntime().createElement(lookup[type], props, children)`. This keeps setters framework-agnostic in source AND uses BaseUI.
- `withLabel(label, control)` helper composes label + control vertically
- The 7 setters must return descriptors where `type` is a BaseUI component name (e.g. `'Field'`, `'Switch'`, `'Select'`, `'Slider'`, etc.) — **NOT** raw HTML tags like `'input'`, `'button'`, `'select'`.
- The L4 settings panel maintains a `{ 'Field': BaseUIField, 'Switch': BaseUISwitch, 'Select': BaseUISelect, 'Slider': BaseUISlider, ... }` lookup. The lookup is the bridge from descriptor → BaseUI JSX.
- **Styling via Tailwind v4 utility classes** (per `feedback-baseui-with-tailwind`, decided 2026-06-07): setters receive Tailwind v4 class strings in their descriptor `props` (e.g. `{ className: 'w-full px-3 py-2 border rounded-md border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500' }`). No raw CSS, no inline `style` objects. The package ships:
  - `tailwindcss` (devDep)
  - `src/styles.css` with `@import "tailwindcss"` + `@theme` design tokens (colors, spacing, typography)
  - `build:css` script: `tailwindcss -i src/styles.css -o lib/styles.css --minify`
  - `build` script: `yarn build:css && tsc`
- React 19 features to consider when implementing setters (per `feedback-react19-and-baseui`):
  - `useActionState` for the input → validate → commit-on-blur flow
  - `useOptimistic` if optimistic UI is needed during slow commits

## BaseUI mapping (the work list for P0.1)

| Setter | Current (raw HTML — **WRONG**) | BaseUI component (`type` string) |
|---|---|---|
| `Input` | `<input type="text" />` | `Field` (single-line) |
| `TextArea` | `<textarea />` | `Field` (multiline) |
| `Number` | `<input type="number" />` | `Field` (type=number) or `Slider` + number readout |
| `Switch` | `<button>` with conditional class | `Switch` |
| `Select` | `<select>` | `Select` |
| `ColorPicker` | `<input type="color" />` | `Slider` (HSL) or custom BaseUI primitive |
| `Slider` | `<input type="range" />` | `Slider` |

## Test coverage

- **None** — no `tests/` directory. Coverage gap. (See [../ROADMAP.md](../ROADMAP.md) P1.2.)
- When adding tests, set the adapter runtime to BaseUI-backed React (`adapter.setRuntime(...)` in `beforeAll`), then snapshot the 7 setters' descriptor output.

## External deps

- `@monbolc/lowcode-types`, `@monbolc/lowcode-utils` (workspace)
- `react`, `react-dom`, `@base-ui-components/react` (peers; BaseUI is now required for this package)
- `tailwindcss` (devDep — Tailwind v4 for setter styling, per `feedback-baseui-with-tailwind`)
- `react`, `react-dom`, `@base-ui-components/react`, `@types/react`, `@types/react-dom` (dev)

## ⚠️ Known issues

### P0.1 — typecheck broken (8 errors) + must use BaseUI (elevated from P1.5)

`SetterComponent` type is `ComponentType<SetterProps>` (React.FC), but `built-in.tsx` writes setters using hyperscript descriptors — TypeScript rejects the descriptor output as not-a-function. Also missing `key` props on the descriptor shapes.

Errors at `built-in.tsx:18, 40, 57, 77, 102, 127, 144` (7) + `registry.ts:73` (1).

**Two paths to fix (both require BaseUI)**:
- **(a)** Change `SetterComponent` to accept hyperscript descriptor. Keep the setters as-is but **change `type` to a BaseUI component name** (e.g. `'Field'` instead of `'input'`). Matches the "framework-agnostic setters" principle.
- **(b)** Rewrite `built-in.tsx` to proper `React.FC<SetterProps>` returning JSX with **BaseUI components** (not raw `<input>`). Cleaner types, but L4 settings panel must also use proper React (not h()).

**Recommendation**: (a) with BaseUI. The L4 settings panel maintains a BaseUI lookup table; setters stay portable.

## Untracked

- The whole `packages/plugin-setters/` directory is untracked. P1.4: `git add packages/plugin-setter*`.

## See also

- [../ROADMAP.md](../ROADMAP.md) — P0.1 (typecheck + BaseUI), P1.2 (tests), P1.3 (wire into L4 settings panel)
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — "Framework-agnostic setters" principle
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — "Use BaseUI" principle (per `feedback-react19-and-baseui`)
- `feedback-react19-and-baseui.md` (memory) — BaseUI mapping reference
- `feedback-confirm-ali-and-third-party.md` (memory) — `@alilc/lowcode-engine-ext` is mentioned in this doc for context only; do not reintroduce it as a dep
