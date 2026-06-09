# `@monbolc/lowcode-plugin-setters` (L2.5)

> **Version**: 2.5.0 · **BaseUI peer (required, MUST be used)** · **typecheck 0 errors** · **v2.3.0 adds `getRegisteredSetterNames` + `ISettersRegistry` + v2.4.0 adds `unregisterSetter` + `hasSetter` (D.I7b.16)**

## Purpose

The setter registry. The upstream gets default setters from the **external** package `@alilc/lowcode-engine-ext` (not vendored in the open-source repo). Sapu ships its own setters in-repo, and per `feedback-react19-and-baseui` they **must** use BaseUI components.

The P0.1 typecheck break was fixed in earlier releases; the 7 built-in setters now return hyperscript descriptors whose `type` is a BaseUI component name (`'Field'`, `'Switch'`, etc.) — see "BaseUI mapping" below.

## Public exports

### Registry (`registry.ts`)
- `registerSetter(name, component)` — register a named setter
- `unregisterSetter(name)` (D.I7b.16) — remove a previously-registered setter; returns `true` on first call (entry was present), `false` on second call (no-op)
- `hasSetter(name)` (D.I7b.16) — query whether a setter is registered
- `getSetter(name)` — look up a registered setter
- `getRegisteredSetterNames()` — **v2.3.0** snapshot the registered setter names (sorted alphabetically). Used by `SapuEngine.setters.list` and the L4 settings panel to enumerate available setters.
- `pickSetter(field)` — pick a setter for a field config; falls back to `Input`
- `resolveSetterName(field)` — resolve the setter name from a field
- `withLabel(label, control)` — vertical label+control composition helper
- `BUILT_IN_SETTERS` — const array: `['Input', 'TextArea', 'Number', 'Switch', 'Select', 'ColorPicker', 'Slider']`
- Types: `SetterComponent`, `SetterProps`, `SetterDescriptor`, `SetterType`

### Slim facade (`types.ts`, v2.3.0)
- `ISettersRegistry` — the slim re-export the L6 `SapuEngine.setters` and `IPluginContext.setters` expose. Currently a single `list(): string[]` method. Mutation goes through `registerSetter()` from this package (the registry's internal `Map` is not directly exposed).
- Re-export: `SetterComponent` (so consumers can `import type` from the slim facade).

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

## Untracked

- Resolved: `packages/plugin-setters/` is tracked since 2026-06-07 (P0.1 P1.4 P1.5 lock-in).

## See also

- [../ROADMAP.md](../ROADMAP.md) — P0.1 (typecheck + BaseUI), P1.2 (tests), P1.3 (wire into L4 settings panel)
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — "Framework-agnostic setters" principle
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — "Use BaseUI" principle (per `feedback-react19-and-baseui`)
- `feedback-react19-and-baseui.md` (memory) — BaseUI mapping reference
- `feedback-confirm-ali-and-third-party.md` (memory) — `@alilc/lowcode-engine-ext` is mentioned in this doc for context only; do not reintroduce it as a dep
