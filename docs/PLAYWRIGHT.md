# Playwright E2E Tests (P2.5)

The `tests/e2e/` directory holds end-to-end tests for the demo.
They drive a real Chromium via Playwright, against the Vite dev
server (`yarn demo`), and exercise the L0–L7 stack as a black
box. The vitest unit tests in `packages/*/tests/` cover
individual classes; this suite covers **integration**.

## What the suite covers

5 spec files, one per HANDOVER "interaction path":

| File | What it exercises | L-layers covered |
|---|---|---|
| `01-initial-render.spec.ts` | Demo mounts; canvas shows initial schema | L7 init, L4 Skeleton, L3 Simulator |
| `02-drag-palette.spec.ts` | Switch left view to Component palette; verify the 7 palette rows | L4 Skeleton (controlled `leftView`), L2.5 ComponentPalette |
| `03-select-and-prop-edit.spec.ts` | Click a node in the outline; edit a `text` prop; see it on canvas | L2 plugin-outline-pane, L4 settings panel, L2.5 setters, L3 DocumentModel |
| `04-undo-redo.spec.ts` | Register a real command on the engine's CommandManager; execute, undo, redo via the API + the toolbar buttons | L2 plugin-command (newly exposed on SapuEngine), L7 engine facade |
| `05-multi-doc.spec.ts` | Open a second `<Skeleton>`; verify both render with independent state; close it | L5 Workspace, L4 Skeleton (sibling mounts) |

## Running locally

```bash
# one-time: install the chromium binary
yarn test:e2e:install

# run the suite (auto-starts `yarn demo` on :5173)
yarn test:e2e

# debug a single spec
yarn playwright test tests/e2e/03-select-and-prop-edit.spec.ts --debug
```

The Playwright config (`playwright.config.ts`) starts the dev
server via `yarn demo` and reuses an already-running instance if
present (controlled by `CI` env var).

## Build-before-test requirement

`yarn demo` (Vite) resolves workspace packages from their built
`lib/` and `es/` outputs, **not** from `src/`. So before running
e2e tests after a `src/` change, you must run `yarn build`. The
typecheck workflow has the same requirement; both rely on
`scripts/typecheck.mjs` / Vite reading the same compiled output.

The CI job `e2e` runs `yarn build` before `yarn test:e2e` to
enforce this.

## Selectors

We prefer accessible selectors over fragile CSS:

- **`getByRole('button', { name: /.../ })`** for icon buttons (the
  Component palette icon is `<button title="Component palette ...">`).
- **`getByRole('banner' | 'complementary' | 'main')`** to disambiguate
  the canvas's user-component DOM (e.g. `<header>`, `<aside>`, `<main>`)
  from the outline tree's text content (which has the same titles).
- **`getByRole('treeitem', { name: /.../ })`** for outline rows
  (react-arborist sets `role="treeitem"` and the accessible name
  includes the title + ✎ + componentName).
- **`[data-lce-id="..."]`** for individual canvas nodes (set by
  `designer/src/dom.ts` for Overlays hit-testing; stable across
  re-renders).
- Vanilla DOM button IDs in `index.html` (`#add-footer`, `#reset`,
  `#undo`, `#redo`, `#open-second`, `#inject-crash`) for the demo
  toolbar — these are plain `<button id="...">` elements.

If you add a new demo UI element, add a stable selector. Common
patterns:
- For a topArea button: add a `title` attribute so it's
  discoverable via `getByRole('button', { name: /title/ })`.
- For a canvas node: rely on the existing `data-lce-id` (set
  automatically by the simulator).
- For a settings panel row: the `SettingsPanel` renders `<code>`
  for the component name and a label div + setter for each prop;
  match on text or `value` of the input.

## Demo affordances for testing

Two windows globals are set by the demo to make E2E tests
straightforward. **Production apps should NOT do this** — these
are demo affordances, not part of the public engine surface.

- `window.__sapu_engine__` — the `SapuEngine` instance (set after
  `init()` resolves). Use it to drive the L2 CommandManager
  directly, e.g. `engine.commands.execute('some.cmd')` from a
  `page.evaluate`.
- `window.__demo__` — handler bundle used by the vanilla DOM
  toolbar buttons (`onAdd`, `onReset`, `onUndo`, etc.). Tests
  don't usually need this; the buttons themselves are the
  user-facing path.

## Adding a new test

1. Create `tests/e2e/<NN>-<short-name>.spec.ts`.
2. Use accessible selectors (see above) — no `nth(0)` or
   `.first()` unless you have a good reason.
3. If the test relies on the engine, wait for
   `window.__sapu_engine__` via `page.waitForFunction` (or use
   the toolbar buttons, which are sync).
4. Run locally before pushing: `yarn test:e2e`.
5. CI runs the same script on Node 20.x after `yarn build`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "BABEL_PARSE_ERROR" parsing the config | A `/*` inside a `/** ... */` JSDoc comment closes it early (e.g. "packages/\*/tests/") | Re-phrase the comment to avoid the `*/` sequence |
| "element not found" on a palette row | The palette rows are `div[title^="Drag to canvas"]`, not `button[...]` | Use `div[title^="..."]` or `[title^="..."]` |
| Tests pass locally, fail in CI | The CI runner has a fresh checkout; lib/ may be stale | CI runs `yarn build` before `yarn test:e2e` — make sure your local flow does the same |
| Strict-mode locator violation (e.g. "Header" matches both outline and canvas) | The outline tree's row text and the canvas's user-component text are both DOM-level text | Use `getByRole('banner')` (canvas `<header>`) or `getByRole('treeitem')` (outline row), not raw `getByText` |
