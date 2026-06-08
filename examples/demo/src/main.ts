/**
 * Hello Sapu — Vite demo entry
 *
 * Wires up the L7 `init()` composition root against a hand-rolled
 * component registry, then renders the L4 Skeleton inside a
 * SapuErrorBoundary. The L7 init() takes care of:
 *   - installing the React runtime into renderer-core
 *   - creating the SapuEngine + Project
 *   - registering the default preset plugins (outline-pane,
 *     settings-panel, setters)
 *   - returning the live engine for the host to use
 *
 * The host (this file) is still responsible for rendering the
 * React tree, including the `<SapuErrorBoundary>` + `<Skeleton>`
 * composition. The engine's `getProject()` is the source of truth
 * for the document; the host reads it via React state.
 *
 * Run via `yarn demo` at the repo root, then open http://localhost:5173.
 *
 * What this demo proves:
 *   - L0–L7 stack composes: one `init()` call returns a live engine.
 *   - L2.5 setters (registered by the default preset) are wired into
 *     the L4 settings panel (right pane).
 *   - A host can register a CUSTOM setter and have the L4 panel use
 *     it for a specific (component, prop) — see the
 *     "Use custom setter" toggle in the toolbar and the `HexColor`
 *     setter defined below.
 *   - L6.7 error pipeline: the "Inject crash" button proves a
 *     throwing plugin gets caught, fires `pluginError`, and the
 *     editor keeps running.
 */
import './styles.css';

import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Project } from '@monbolc/lowcode-designer';
import { Skeleton } from '@monbolc/lowcode-editor-skeleton';
import { Resource, Workspace } from '@monbolc/lowcode-workspace';
import { SapuErrorBoundary, type ISapuEngine } from '@monbolc/lowcode-shell';
import { init, createDefaultPreset } from '@monbolc/lowcode-engine';
import type { OutlinePane } from '@monbolc/lowcode-plugin-outline-pane';
import { OutlineIcon, ComponentsIcon } from '@monbolc/lowcode-editor-skeleton/widgets/icons';
import {
  registerSetter,
  type SetterComponent,
  type SetterProps,
} from '@monbolc/lowcode-plugin-setters';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

// Note: setupReactRenderer() is no longer called here — the L7
// `init()` below installs the React 19 runtime as its first step.

// ---------------------------------------------------------------------------
// 1a. `hexToCss` — normalize a hex color string into a CSS `background`
//     value. Accepts `0xfff3c7` (HexColor setter output) or `#fff3c7`
//     (plain CSS) and returns the CSS form. Returns `undefined` for
//     empty / non-string input so callers can `?? fallback`.
// ---------------------------------------------------------------------------
function hexToCss(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  if (raw.startsWith('0x') || raw.startsWith('0X')) {
    return `#${raw.slice(2)}`;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// 2. Custom setter — `HexColor`.
//    Setters are pure data: return a `SetterDescriptor` (string-typed vdom).
//    The L4 panel resolves `'Input'` to BaseUI.Input and renders it.
//    This setter prefixes the user's text with `0x` and suffixes with
//    ` (hex)`. It commits on blur like the built-in `Input` setter.
// ---------------------------------------------------------------------------
const HexColor: SetterComponent = ({ value, onChange }: SetterProps) => {
  const v = typeof value === 'string' ? value : '0x000000';
  return {
    type: 'Input',
    props: {
      className:
        'w-full px-2 py-1 text-xs font-mono text-slate-900 border border-slate-300 rounded ' +
        'bg-amber-50 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500',
      defaultValue: v,
      type: 'text',
      onBlur: (e: { target: { value: string } }) => {
        const next = e.target.value.startsWith('0x')
          ? e.target.value
          : `0x${e.target.value.replace(/^0x/, '')}`;
        onChange(next as never);
      },
    },
  };
};

// ---------------------------------------------------------------------------
// 3. Component registry — what the canvas simulator renders.
// ---------------------------------------------------------------------------
const components: Record<string, React.FC<any>> = {
  Header:  (p) => React.createElement('header',  { ...p, style: { ...p.style, padding: 12, background: '#dbeafe', borderRadius: 4, marginBottom: 8 } }, 'Header'),
  Body:    (p) => React.createElement('section', { ...p, style: { ...p.style, display: 'flex', gap: 8 } }, p.children),
  // `p.bg` may arrive in either CSS-hex form (`#fff3c7`) or
  // 0x-prefixed form (`0xfff3c7`, the HexColor setter's output).
  // CSS only understands the first; the converter preserves the
  // 0x format the setter produces so the canvas + the value
  // shown in the setter stay in sync.
  Sidebar: (p) => React.createElement('aside',   { ...p, style: { ...p.style, width: 200, padding: 12, background: hexToCss(p.bg) ?? '#fef3c7', borderRadius: 4 } }, 'Sidebar'),
  Main:    (p) => React.createElement('main',    { ...p, style: { ...p.style, flex: 1, padding: 12, background: '#dcfce7', borderRadius: 4 } }, 'Main'),
  Footer:  (p) => React.createElement('footer',  { ...p, style: { ...p.style, padding: 12, background: '#fce7f3', borderRadius: 4, marginTop: 8 } }, 'Footer'),
  // Generic building blocks. `Div` is a neutral container — no
  // styling, just forwards children. `Text` renders its `text` prop
  // as the child string (the schema model has no "text" channel,
  // so we use a `text` prop and ignore the React-children
  // convention). The settings panel's `inferSetterName` sees
  // `text: string` and renders an `Input` setter for it.
  Div:   (p) => React.createElement('div',   { ...p, style: { ...p.style, padding: 8, border: '1px dashed #cbd5e1', borderRadius: 4, minHeight: 24 } }, p.children),
  Text:  (p) => React.createElement('span',  { ...p, style: { ...p.style, fontSize: 13, color: '#0f172a' } }, typeof p.text === 'string' ? p.text : 'Text'),
};

// ---------------------------------------------------------------------------
// 4. Initial schema.
// ---------------------------------------------------------------------------
const initialSchema = {
  fileName: 'home.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header', props: { className: 'header' } },
    { componentName: 'Body', props: { className: 'body' }, children: [
      { componentName: 'Sidebar', props: { className: 'sidebar', bg: '0xfff3c7' } },
      { componentName: 'Main',    props: { className: 'main'    } },
    ] },
    // A generic `Div` container (so the user can see what an empty
    // container looks like, and drag child components into it) and
    // a `Text` showing the `text` prop wired through to the DOM.
    // Both also appear in the Component palette, so they're
    // drag-and-drop targets as well.
    { componentName: 'Div',  props: { className: 'div-demo' } },
    { componentName: 'Text', props: { text: 'Hello from Text' } },
  ],
};

// ---------------------------------------------------------------------------
// 5. The demo React app.
// ---------------------------------------------------------------------------
function App({ engine }: { engine: ISapuEngine }) {
  const [schema, setSchema] = useState<IPublicTypeRootSchema>(initialSchema as unknown as IPublicTypeRootSchema);
  // The L7 init() returns a SapuEngine; we use `getProject()` as the
  // single source of truth for the document. Same engine for the
  // whole session — re-mounts would require a new init() call.
  const project = engine.getProject();
  // The Skeleton owns the OutlinePane internally. We capture the
  // reference via `onPaneReady` so the toolbar buttons can call
  // pane-level actions (rename, expand, select) directly.
  const paneRef = useRef<OutlinePane | null>(null);
  // When ON, the host has registered the custom `HexColor` setter and
  // told the L4 settings panel to use it for `Sidebar.bg`. Toggling
  // OFF unregisters it; the L4 panel falls back to the inferred
  // `Input` setter for that prop.
  const [customOn, setCustomOn] = useState(false);

  // L4 left view: which built-in view the left panel is showing.
  // The demo drives the Skeleton in CONTROLLED mode (passes
  // `leftView` + `onLeftViewChange`) so the icon strip in the
  // leftArea slot can flip the state. Without this, the user has
  // no way to switch between Outline and Component palette.
  const [leftView, setLeftView] = useState<'outline' | 'components'>('outline');

  // Push schema into the project AFTER render, never during it.
  useEffect(() => {
    project.load(schema);
  }, [schema, project]);

  // (Re-)register / unregister the custom setter whenever the toggle
  // changes. The L4 panel consults the registry on every render, so
  // flipping the toggle and selecting `Sidebar` is enough to see the
  // change immediately.
  useEffect(() => {
    if (customOn) {
      registerSetter('HexColor', HexColor);
    } else {
      // Unregister: registerSetter with `null` would be cleaner, but
      // the public API only exposes `registerSetter(name, comp)`. We
      // override with a sentinel that throws if it ever runs — this
      // way the panel's `pickSetter` falls back to 'Input' (which is
      // the "use the default" behaviour we want when the toggle is
      // off).
      registerSetter('HexColor', () => {
        throw new Error('HexColor is unregistered. Toggle it on in the toolbar.');
      });
    }
    // Reflect the toggle state in the toolbar button label.
    const btn = document.getElementById('toggle-custom');
    if (btn) btn.textContent = `Use custom setter: ${customOn ? 'on' : 'off'}`;
  }, [customOn]);

  // Declarative override: when `customOn`, route the `Sidebar.bg`
  // prop through the custom `HexColor` setter instead of the
  // inferred `Input` setter.
  const setterConfig: Record<string, Record<string, string>> = customOn
    ? { Sidebar: { bg: 'HexColor' } }
    : {};

  const onAdd = () => {
    setSchema((s) => ({
      ...s,
      children: [...(s.children ?? []), { componentName: 'Footer', props: { className: 'footer' } }],
    }));
  };
  const onRename = () => {
    const pane = paneRef.current;
    if (!pane) return;
    const body = pane.nodes.find((n) => n.componentName === 'Body');
    if (body) pane.rename(body.id, 'App');
  };
  const onReset = () => {
    setSchema({
      fileName: 'home.json',
      componentName: 'Page',
      children: [
        { componentName: 'Header', props: { className: 'header' } },
        { componentName: 'Body', props: { className: 'body' }, children: [
          { componentName: 'Sidebar', props: { className: 'sidebar', bg: '0xfff3c7' } },
          { componentName: 'Main',    props: { className: 'main'    } },
        ] },
        { componentName: 'Div',  props: { className: 'div-demo' } },
        { componentName: 'Text', props: { text: 'Hello from Text' } },
      ],
    } as unknown as IPublicTypeRootSchema);
  };
  const onToggleCustom = () => setCustomOn((v) => !v);

  // L6.7 — Inject crash. Registers a plugin whose `init` throws.
  // The engine catches the throw and fires `pluginError`; nothing
  // else is affected. We also listen for `pluginError` and flash
  // a one-line banner via a `pluginErrorCount` state so the user
  // sees something happened without digging through console logs.
  const [pluginErrorCount, setPluginErrorCount] = useState(0);
  useEffect(() => {
    const off = engine.events.on('pluginError', () => {
      setPluginErrorCount((n) => n + 1);
    });
    return off;
  }, [engine]);
  const onInjectCrash = () => {
    engine.registerPlugin({
      name: `crash-${Date.now()}`,
      init: () => { throw new Error('manual crash from demo inject button'); },
    });
  };

  // L5 demo: open a SECOND editing session in a sibling div. Each
  // <Skeleton> owns its own Project + Workspace. The two sessions
  // share the `components` registry (so the simulator can render
  // both), but selection / schema state is fully independent —
  // clicking a node in one outline does NOT affect the other.
  //
  // Toggle: button label flips between "Open second doc" and
  // "Close second doc". On open we APPEND a fresh host div to the
  // row container (so the first Skeleton doesn't lose its
  // full-width state) and mount a fresh <Skeleton>; on close we
  // unmount it cleanly (deferred microtask, like the Skeleton's
  // own simulator teardown), dispose the L5 workspace, and REMOVE
  // the host div so the first Skeleton expands to full width.
  const [secondRoot, setSecondRoot] = useState<Root | null>(null);
  const [secondWs, setSecondWs] = useState<Workspace | null>(null);
  const [secondActive, setSecondActive] = useState(false);
  const onToggleSecond = () => {
    if (secondActive) {
      // CLOSE: unmount the second <Skeleton>, dispose the L5
      // workspace, then REMOVE the host div so the first Skeleton
      // reclaims the full row width.
      if (secondRoot) {
        // queueMicrotask matches the pattern in editor-skeleton
        // (simulator root cleanup) — React 19 rejects synchronous
        // unmounts that happen during another component's commit.
        queueMicrotask(() => secondRoot.unmount());
      }
      secondWs?.dispose();
      const host = document.getElementById('skeleton-2');
      if (host) host.remove();
      setSecondRoot(null);
      setSecondWs(null);
      setSecondActive(false);
    } else {
      // OPEN: construct a fresh host div, append to the row
      // container (so it's a sibling of #skeleton), then mount a
      // fresh <Skeleton> in it.
      const row = document.getElementById('skeleton-row');
      if (!row) return;
      const host = document.createElement('div');
      host.id = 'skeleton-2';
      host.className = 'demo-skeleton';
      host.style.cssText = 'flex:1; min-width:0; border-left:1px solid #e2e8f0;';
      row.appendChild(host);
      const schema: IPublicTypeRootSchema = {
        fileName: 'second.json',
        componentName: 'Page',
        children: [
          { componentName: 'Header', props: { className: 'header-2' } },
          { componentName: 'Main',   props: { className: 'main-2' } },
        ],
      };
      const project2 = new Project(schema);
      const resource = new Resource({ id: 'r2', title: 'Second Doc', project: project2 });
      const ws = new Workspace({ autoOpenFirstWindow: true });
      ws.addResource(resource);
      const root2 = createRoot(host as Element);
      root2.render(
        React.createElement(Skeleton as any, {
          project: project2,
          components,
          // No custom leftArea: the second Skeleton falls back to
          // the Skeleton's default leftArea (the Out/Cmp view
          // switcher). The demo's previous "reset doc 2" button
          // was an extra convenience that's been removed along
          // with the other extras in the first Skeleton's leftArea
          // — "close + reopen" is the supported way to reset.
        }),
      );
      setSecondRoot(root2);
      setSecondWs(ws);
      setSecondActive(true);
    }
  };

  // Reflect toggle state in the toolbar button label. The vanilla-
  // DOM button click handler reads `secondActive` via the closure
  // captured here, so we just keep the text in sync.
  useEffect(() => {
    const btn = document.getElementById('open-second');
    if (btn) btn.textContent = secondActive ? 'Close second doc' : 'Open second doc';
  }, [secondActive]);

  // Expose handlers globally so the toolbar buttons (outside the React tree)
  // can call them.
  (window as any).__demo__ = { onAdd, onRename, onReset, onToggleCustom, onToggleSecond, onInjectCrash, secondRoot: () => secondRoot };

  // The Skeleton's `topArea` slot — a sub-toolbar above the canvas
  // in normal flow (mirrors ali's `subTopArea`). Plain inline
  // buttons; no floating pill, no backdrop-blur.
  const topArea = () =>
    React.createElement(
      'div',
      { className: 'flex items-center gap-1.5' },
      React.createElement(
        'button',
        {
          className: 'px-2 py-0.5 border border-slate-300 rounded bg-white hover:bg-slate-50 text-[11px]',
          onClick: onAdd,
          title: 'Append a Footer node to the document',
        },
        '+ Footer',
      ),
      React.createElement(
        'button',
        {
          className: 'px-2 py-0.5 border border-slate-300 rounded bg-white hover:bg-slate-50 text-[11px]',
          onClick: onRename,
          title: 'Rename the Body node in the outline',
        },
        'Body → App',
      ),
      React.createElement(
        'button',
        {
          className: 'px-2 py-0.5 border border-slate-300 rounded bg-white hover:bg-slate-50 text-[11px]',
          onClick: onReset,
          title: 'Reset the document to the initial schema',
        },
        'Reset',
      ),
      React.createElement('div', { className: 'w-px h-4 bg-slate-200 mx-0.5' }),
      React.createElement(
        'button',
        {
          className:
            'px-2 py-0.5 border rounded text-[11px] ' +
            (customOn
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-slate-300 bg-white hover:bg-slate-50'),
          onClick: onToggleCustom,
          title: 'Register the HexColor setter for Sidebar.bg',
        },
        customOn ? 'HexColor: on' : 'HexColor: off',
      ),
      React.createElement('div', { className: 'w-px h-4 bg-slate-200 mx-0.5' }),
      // L6.7 — Inject crash. Registers a plugin whose init() throws.
      // SapuEngine catches the throw, fires `pluginError`, and
      // unregisters the plugin so a re-registration can succeed.
      // The console gets a stack trace; the editor itself keeps
      // running.
      React.createElement(
        'button',
        {
          className: 'px-2 py-0.5 border border-rose-300 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px]',
          onClick: onInjectCrash,
          title: 'Register a plugin whose init() throws — exercises the L6.3 error pipeline',
        },
        'Inject crash',
      ),
    );

  // The Skeleton's `leftArea` slot — a thin icon strip to the LEFT
  // of the outline panel. Ali's `leftArea` is the icon column.
  // The demo uses CONTROLLED mode (`leftView` + `onLeftViewChange`
  // wired to <Skeleton>) so the user can flip between the Outline
  // tree and the Component palette (drag-and-drop source).
  // Each button shows a small inline SVG (no text glyph, no emoji
  // — matches what the Skeleton's default leftArea does when no
  // custom slot is provided). The title attribute carries the
  // accessible name + a hover tooltip.
  const leftArea = () =>
    React.createElement(
      'div',
      { className: 'flex flex-col items-center gap-1' },
      React.createElement(
        'button',
        {
          type: 'button',
          className:
            'w-7 h-7 flex items-center justify-center border border-slate-200 ' +
            'rounded hover:bg-slate-100 ' +
            (leftView === 'outline' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : ''),
          onClick: () => setLeftView('outline'),
          title: 'Outline view',
        },
        React.createElement(OutlineIcon as any, {}),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className:
            'w-7 h-7 flex items-center justify-center border border-slate-200 ' +
            'rounded hover:bg-slate-100 ' +
            (leftView === 'components' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : ''),
          onClick: () => setLeftView('components'),
          title: 'Component palette (drag to canvas)',
        },
        React.createElement(ComponentsIcon as any, {}),
      ),
    );

  return React.createElement(
    'div',
    { className: 'flex flex-col h-full' },
    pluginErrorCount > 0
      ? React.createElement(
          'div',
          {
            'data-testid': 'plugin-error-banner',
            className: 'bg-rose-50 border-b border-rose-200 px-3 py-1 text-[11px] text-rose-700 flex items-center gap-2',
          },
          `Plugin errors: ${pluginErrorCount} since page load. See browser console for details.`,
        )
      : null,
    React.createElement(
      'div',
      { className: 'flex-1 min-h-0' },
      React.createElement(
        SapuErrorBoundary as any,
        { engine },
        React.createElement(Skeleton as any, {
          project,
          components,
          onPaneReady: (p: OutlinePane) => { paneRef.current = p; },
          setterConfig,
          topArea,
          leftArea,
          leftView,
          onLeftViewChange: setLeftView,
        }),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// 6. Mount.
// ---------------------------------------------------------------------------
// L7: one async `init()` call sets up the engine, registers the
// default preset, mounts the project, and returns the live
// SapuEngine. We then hand the engine to <App engine={...}/>
// which renders the Skeleton against `engine.getProject()`.
init(document.getElementById('skeleton')!, {
  schema: initialSchema as unknown as IPublicTypeRootSchema,
  components,
  preset: createDefaultPreset({ locale: 'en-US' }),
}).then((engine) => {
  const root = createRoot(document.getElementById('skeleton')!);
  root.render(React.createElement(App, { engine }));
});

// ---------------------------------------------------------------------------
// 7. Toolbar wiring (vanilla DOM, no React).
// ---------------------------------------------------------------------------
(document.getElementById('add-footer') as HTMLButtonElement).onclick        = () => (window as any).__demo__.onAdd();
(document.getElementById('rename-page') as HTMLButtonElement).onclick       = () => (window as any).__demo__.onRename();
(document.getElementById('reset') as HTMLButtonElement).onclick             = () => (window as any).__demo__.onReset();
(document.getElementById('toggle-custom') as HTMLButtonElement).onclick    = () => (window as any).__demo__.onToggleCustom();
(document.getElementById('open-second') as HTMLButtonElement).onclick       = () => (window as any).__demo__.onToggleSecond();
(document.getElementById('inject-crash') as HTMLButtonElement).onclick      = () => (window as any).__demo__.onInjectCrash();
