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
import { createPortal } from 'react-dom';
import { Project } from '@monbolc/lowcode-designer';
import { Skeleton, OutlineIcon, ComponentsIcon } from '@monbolc/lowcode-editor-skeleton';
import { Resource, Workspace } from '@monbolc/lowcode-workspace';
import { SapuErrorBoundary, type ISapuEngine, type I18nMessage } from '@monbolc/lowcode-shell';
import { init, createDefaultPreset, setTheme, getTheme, onThemeChange } from '@monbolc/lowcode-engine';
import type { IPublicTypeDragObject, IPublicTypeNodeLike } from '@monbolc/lowcode-types';
import type { OutlinePane } from '@monbolc/lowcode-plugin-outline-pane';
import {
  registerSetter,
  type SetterComponent,
  type SetterProps,
} from '@monbolc/lowcode-plugin-setters';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

// Engine + designer package version constants for the StatusBar.
// The `@monbolc/lowcode-engine` and `@monbolc/lowcode-designer`
// packages both pin to `2.2.0`; the StatusBar surfaces them so
// the user can see which build the demo is running. Relative
// paths (not the `@monbolc/*` aliases) so the Vite alias for
// `<pkg>/src/index.ts` doesn't intercept the json import.
import ENGINE_PKG from '../../../packages/engine/package.json';
import DESIGNER_PKG from '../../../packages/designer/package.json';

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
// 4. Initial schema + preset schemas (the "Schema" picker in the
//    topArea lets the user swap between these without reloading).
//    Each preset is a real `IPublicTypeRootSchema` — same shape as
//    a saved JSON file would be — and exercises different facets of
//    the engine:
//      - `home`   — default 4-pane layout (Header / Body / Footer / etc.)
//      - `form`   — Form container with Input + Text, exercises the
//                   `text: string` → `<Input>` setter wiring
//      - `cards`  — 3 nested Divs with distinct background colors,
//                   exercises per-instance rect math on multi-instance
//                   components
//      - `empty`  — bare Header only, lets the user start from scratch
//                   with the palette
// ---------------------------------------------------------------------------
type PresetId = 'home' | 'form' | 'cards' | 'empty';

const homeSchema = {
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
} as const;

const formSchema = {
  fileName: 'form.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header', props: { className: 'header' } },
    { componentName: 'Body', props: { className: 'body' }, children: [
      { componentName: 'Text', props: { text: 'Sign up' } },
      { componentName: 'Text', props: { text: 'Name' } },
      { componentName: 'Text', props: { text: 'Email' } },
      { componentName: 'Text', props: { text: 'Submit' } },
    ] },
  ],
} as const;

const cardsSchema = {
  fileName: 'cards.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header', props: { className: 'header' } },
    { componentName: 'Body', props: { className: 'body' }, children: [
      { componentName: 'Main', props: { className: 'main' } },
      { componentName: 'Sidebar', props: { className: 'sidebar', bg: '0xfde68a' } },
      { componentName: 'Sidebar', props: { className: 'sidebar', bg: '0xbbf7d0' } },
      { componentName: 'Sidebar', props: { className: 'sidebar', bg: '0xbfdbfe' } },
    ] },
  ],
} as const;

const emptySchema = {
  fileName: 'empty.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header', props: { className: 'header' } },
  ],
} as const;

const SCHEMA_PRESETS: Record<PresetId, IPublicTypeRootSchema> = {
  home: homeSchema as unknown as IPublicTypeRootSchema,
  form: formSchema as unknown as IPublicTypeRootSchema,
  cards: cardsSchema as unknown as IPublicTypeRootSchema,
  empty: emptySchema as unknown as IPublicTypeRootSchema,
};

const PRESET_LABELS: Record<PresetId, string> = {
  home: 'Home (default)',
  form: 'Form (text inputs)',
  cards: 'Cards (multi-instance)',
  empty: 'Empty (palette playground)',
};

// `initialSchema` is what the demo loads on first paint. We keep
// `homeSchema` (the default) as the initial; the picker lets the
// user switch to the others without reloading the page.
const initialSchema = SCHEMA_PRESETS.home;

// ---------------------------------------------------------------------------
// 4a. Demo i18n messages — register a small set of keys so the
//     StatusBar can call `engine.t('status.project')` etc. and the
//     locale switcher in the topArea can flip them visibly. The keys
//     are scoped under `status.*` (StatusBar labels) and `button.*`
//     (topArea buttons). Production apps register their own keys
//     per feature; this is the demo's minimum surface.
// ---------------------------------------------------------------------------
const DEMO_I18N: Record<string, Record<string, string>> = {
  en: {
    'status.project': 'Project',
    'status.schema': 'Schema',
    'status.nodes': 'Nodes',
    'status.selection': 'Selection',
    'status.theme': 'Theme',
    'status.locale': 'Locale',
    'status.engine': 'Engine',
    'button.theme': 'Theme',
    'button.locale': 'Locale',
    'button.schema': 'Schema',
  },
  'zh-CN': {
    'status.project': '项目',
    'status.schema': 'Schema',
    'status.nodes': '节点数',
    'status.selection': '选中',
    'status.theme': '主题',
    'status.locale': '语言',
    'status.engine': '引擎',
    'button.theme': '主题',
    'button.locale': '语言',
    'button.schema': 'Schema',
  },
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

  // Phase C.Y demo polish: live theme + locale + selection counts
  // for the StatusBar. The initial theme is the L7 singleton
  // (set by `init()` from the L7 preset's `theme` field); the
  // initial locale matches what `detectLocale()` picked.
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme());
  // The locale is sourced from the engine's ShellI18n. The
  // `detectLocale()` is internal to L7; we just read the current
  // value at mount and trust subsequent `setLocale` calls.
  const [locale, setLocaleState] = useState<string>(engine.i18n.locale);
  // Live selection count (StatusBar reflects `n selected`). Starts
  // at 0; the first `selectionChanged` event updates it.
  const [selectionCount, setSelectionCount] = useState<number>(0);
  // Live total node count (just the document node map size).
  const [nodeCount, setNodeCount] = useState<number>(project.document.nodes.size);
  // The currently-loaded preset (drives the schema picker).
  const [activePreset, setActivePreset] = useState<PresetId>('home');

  // Register the demo i18n messages ONCE at mount. The keys
  // use the `I18nMessage` shape: `{ default, 'en-US'?, 'zh-CN'? }`.
  // `engine.i18n.register()` accepts string OR I18nMessage values;
  // we always pass the structured form so the locale switcher
  // has a visible effect.
  useEffect(() => {
    const flattened: Record<string, I18nMessage> = {};
    for (const [key, valByLocale] of Object.entries(DEMO_I18N)) {
      flattened[key] = {
        default: valByLocale.en ?? key,
        ...(valByLocale['en-US'] ? { 'en-US': valByLocale['en-US'] } : {}),
        ...(valByLocale['zh-CN'] ? { 'zh-CN': valByLocale['zh-CN'] } : {}),
      };
    }
    engine.i18n.register(flattened);
  }, [engine]);

  // Subscribe to theme changes (L7's setTheme fires
  // `onThemeChange(from, to)`). The hook keeps the React state
  // in sync so the StatusBar's `theme` label flips immediately
  // and the toggle button in topArea shows the right state.
  useEffect(() => {
    return onThemeChange((_from, to) => setThemeState(to));
  }, []);

  // Subscribe to selection + node-count changes on the project.
  // The Project re-emits `selectionChanged` whenever the
  // selection is mutated; we keep a live count for the StatusBar.
  // Document changes (`nodeAdded` / `nodeRemoved` / `rootChanged`)
  // drive the node count.
  useEffect(() => {
    const off1 = project.events.on('selectionChanged', (e) => {
      setSelectionCount(e.ids.length);
    });
    const off2 = project.events.on('nodeAdded', () => {
      setNodeCount(project.document.nodes.size);
    });
    const off3 = project.events.on('nodeRemoved', () => {
      setNodeCount(project.document.nodes.size);
    });
    const off4 = project.events.on('rootChanged', () => {
      setNodeCount(project.document.nodes.size);
    });
    return () => { off1(); off2(); off3(); off4(); };
  }, [project]);

  // Theme / locale toggle handlers.
  const onToggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
    // The `onThemeChange` subscription above will update local state.
  };
  const onToggleLocale = () => {
    const next: 'en-US' | 'zh-CN' = locale === 'zh-CN' ? 'en-US' : 'zh-CN';
    engine.i18n.setLocale(next);
    setLocaleState(next);
  };
  const onPickSchema = (e: { target: { value: string } }) => {
    const id = e.target.value as PresetId;
    setActivePreset(id);
    setSchema(SCHEMA_PRESETS[id]);
  };

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

  // Default props seeded when a palette row is dropped on the
  // canvas. Without these, dragging a vanilla `Text` would land a
  // node with `props: {}` and the settings panel would show
  // "Props (0)" — the user couldn't edit anything until they
  // somehow added a key. The meta map is the documented escape
  // hatch: it tells ComponentPalette what the most common props
  // for each component are.
  //
  // NOTE: keep `Text.text` as a string. The setter's `onChange`
  // will overwrite the default with whatever the user types.
  // For `Text` the demo also expects the initial value 'Text'
  // to show up in the canvas as the rendered children (the
  // `Text` component reads `p.text` and forwards it to a
  // <span>); the string 'Text' is the visual marker.
  const componentMeta: Record<string, Record<string, unknown>> = {
    Header:  { className: 'header' },
    Body:    { className: 'body' },
    Sidebar: { className: 'sidebar', bg: '0xfff3c7' },
    Main:    { className: 'main' },
    Footer:  { className: 'footer' },
    Div:     { className: 'div' },
    Text:    { text: 'Text' },
  };

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

  // Dragon activity log (P5 PublicDragon facade proof). Each
  // entry is `{ts, kind, payload, copy?}`; we keep the most
  // recent 8 and render them in the top-right corner so the
  // user can SEE the new facade dispatching events when they
  // drag a palette row onto the canvas.
  type Activity =
    | { ts: number; kind: 'dragstart'; dragObject: IPublicTypeDragObject<IPublicTypeNodeLike>; copy: boolean }
    | { ts: number; kind: 'drag'; x: number; y: number; dragObject: IPublicTypeDragObject<IPublicTypeNodeLike>; copy: boolean }
    | { ts: number; kind: 'dragend'; dragObject: IPublicTypeDragObject<IPublicTypeNodeLike>; copy: boolean; cancelled: boolean };
  const [activity, setActivity] = useState<Activity[]>([]);
  const [dragonState, setDragonState] = useState({ dragging: false, boosting: false, sensors: 0 });
  useEffect(() => {
    const off1 = engine.dragon.onDragstart((e) => {
      setActivity((a) => [...a.slice(-7), { ts: Date.now(), kind: 'dragstart', dragObject: e.dragObject, copy: e.copy }]);
    });
    const off2 = engine.dragon.onDrag((e) => {
      setActivity((a) => [...a.slice(-7), { ts: Date.now(), kind: 'drag', x: e.locateEvent.clientX, y: e.locateEvent.clientY, dragObject: e.dragObject, copy: e.copy }]);
    });
    const off3 = engine.dragon.onDragend((e) => {
      setActivity((a) => [...a.slice(-7), { ts: Date.now(), kind: 'dragend', dragObject: e.dragObject, copy: e.copy, cancelled: e.cancelled }]);
    });
    return () => { off1(); off2(); off3(); };
  }, [engine]);
  // Poll the public Dragon's state 5× per second. The wrapper
  // doesn't expose a "stateChanged" event (ali doesn't either);
  // a cheap 200ms poll is the documented escape hatch.
  useEffect(() => {
    const id = setInterval(() => {
      setDragonState({
        dragging: engine.dragon.dragging,
        boosting: engine.dragon.boosting,
        sensors: engine.dragon.sensors.length,
      });
    }, 200);
    return () => clearInterval(id);
  }, [engine]);
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
  (window as any).__demo__ = {
    onAdd,
    onRename,
    onReset,
    onToggleCustom,
    onToggleSecond,
    onInjectCrash,
    onUndo: () => { void engine.commands.undo(); },
    onRedo: () => { void engine.commands.redo(); },
    secondRoot: () => secondRoot,
  };

  // P14.1: document-level keyboard shortcuts for undo/redo.
  // Cmd+Z (Mac) / Ctrl+Z (Windows/Linux) → undo.
  // Cmd+Shift+Z / Ctrl+Shift+Z (and Ctrl+Y on Windows) → redo.
  // Ali-faithful: the standard editor convention. Gated on:
  //   - The user is NOT typing in an input/textarea/contentEditable
  //     (so the Settings panel setter inputs work normally).
  //   - The shortcut actually matches (meta or ctrl + z).
  // Scoped to the document so it works regardless of which
  // panel has focus. Ali does the same in their host shell.
  const onKeydown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    // Windows/Linux redo convention: Ctrl+Y (in addition to Ctrl+Shift+Z).
    // Check this BEFORE the Z filter so the typecheck sees the
    // comparison is reachable.
    if (e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      void engine.commands.redo();
      return;
    }
    if (e.key !== 'z' && e.key !== 'Z') return;
    e.preventDefault();
    if (e.shiftKey) {
      // Cmd+Shift+Z (Mac) / Ctrl+Shift+Z (Win/Linux)
      void engine.commands.redo();
    } else {
      void engine.commands.undo();
    }
  };
  document.addEventListener('keydown', onKeydown);
  // Track the handler for symmetric teardown in case the demo
  // ever reloads (Vite HMR can re-run the module).
  (window as unknown as { __demo_cleanup__?: () => void }).__demo_cleanup__ = () => {
    document.removeEventListener('keydown', onKeydown);
  };

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
      // Phase C.Y demo polish: theme + locale + schema preset
      // switchers. Wire into L7's setTheme / engine.i18n.setLocale
      // / project.load respectively. The StatusBar at the bottom
      // reflects the live values via onThemeChange + event
      // subscriptions declared in App().
      React.createElement(
        'button',
        {
          'data-testid': 'theme-toggle',
          className:
            'px-2 py-0.5 border rounded text-[11px] ' +
            (theme === 'dark'
              ? 'border-slate-500 bg-slate-700 text-slate-100'
              : 'border-slate-300 bg-white hover:bg-slate-50'),
          onClick: onToggleTheme,
          title: "L7 setTheme: flip <html data-theme> between 'light' and 'dark'",
        },
        `Theme: ${theme}`,
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'locale-toggle',
          className: 'px-2 py-0.5 border border-slate-300 rounded bg-white hover:bg-slate-50 text-[11px]',
          onClick: onToggleLocale,
          title: "L6.5 ShellI18n.setLocale: flip between en-US and zh-CN (re-renders StatusBar labels)",
        },
        `Locale: ${locale}`,
      ),
      React.createElement(
        'select',
        {
          'data-testid': 'schema-picker',
          value: activePreset,
          onChange: onPickSchema,
          title: 'Pick a preset schema. Calls project.load() to swap the document.',
          className: 'px-1.5 py-0.5 border border-slate-300 rounded bg-white text-[11px]',
        },
        (Object.keys(SCHEMA_PRESETS) as PresetId[]).map((id) =>
          React.createElement('option', { key: id, value: id }, PRESET_LABELS[id]),
        ),
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
      { className: 'flex-1 min-h-0 relative' },
      React.createElement(
        SapuErrorBoundary as any,
        { engine },
        React.createElement(Skeleton as any, {
          project,
          components,
          onPaneReady: (p: OutlinePane) => { paneRef.current = p; },
          setterConfig,
          componentMeta,
          topArea,
          leftArea,
          leftView,
          onLeftViewChange: setLeftView,
          // v2.3: pass the public Dragon facade so ComponentPalette
          // uses `dragon.from(rowEl, ...)` instead of the manual
          // `onPointerDown` path. The activity panel below the
          // Skeleton will then show the dragstart/drag/dragend
          // events as the user drags a palette row.
          dragon: engine.dragon,
          // v2.4: pass the engine's command manager so the outline
          // × button routes through `document.remove` (undoable).
          // The default `@sapu/builtin-document-commands` plugin
          // (registered by `createDefaultPlugins()`) wires the
          // command implementations.
          commands: engine.commands,
        }),
      ),
      // P5 PublicDragon facade proof: a fixed bottom-right panel
      // showing live Dragon state + the last 8 events. When the
      // user drags a palette row onto the canvas, `dragstart →
      // drag* → dragend` entries stream in here, proving the
      // facade is wired end-to-end. Monospace, no animations, no
      // icons — minimal UI noise.
      React.createElement(
        'div',
        {
          'data-testid': 'dragon-activity-panel',
          className:
            'absolute bottom-2 right-2 w-72 max-h-56 overflow-auto ' +
            'bg-slate-900/95 text-slate-100 text-[10px] font-mono ' +
            'rounded shadow-lg border border-slate-700 p-2 z-[10000]',
        },
        React.createElement(
          'div',
          { className: 'flex items-center justify-between mb-1' },
          React.createElement('span', { className: 'font-semibold text-amber-300' }, 'engine.dragon'),
          React.createElement(
            'span',
            { className: 'text-slate-400', 'data-testid': 'dragon-state' },
            `dragging=${dragonState.dragging ? '1' : '0'} boosting=${dragonState.boosting ? '1' : '0'} sensors=${dragonState.sensors}`,
          ),
        ),
        activity.length === 0
          ? React.createElement('div', { className: 'text-slate-500 italic' }, 'drag a palette row → events stream here')
          : activity.map((a, i) => {
              const obj = describeDragObject(a.dragObject);
              const copyTag = a.kind === 'dragstart' || a.kind === 'drag' || a.kind === 'dragend'
                ? (a.copy ? ' COPY' : '')
                : '';
              const cancelledTag = a.kind === 'dragend' && a.cancelled ? ' cancelled' : '';
              const xyTag = a.kind === 'drag' ? ` @(${a.x},${a.y})` : '';
              const kind = a.kind === 'dragstart' ? '▶ start' : a.kind === 'drag' ? '  drag' : '◼ end  ';
              return React.createElement(
                'div',
                { key: i, 'data-testid': 'dragon-event', className: 'leading-tight' },
                `${kind}${xyTag} ${obj}${copyTag}${cancelledTag}`,
              );
            }),
      ),
      // Phase C.Y demo polish: StatusBar. A 24px-tall chrome
      // bar that lives at the bottom of the Skeleton row. Shows
      // live engine state — version, schema, node count,
      // selection count, theme, locale. The values flip in
      // response to user actions (schema picker, theme toggle,
      // locale toggle, click an outline row to change the
      // selection, undo/redo to change the command stack).
      //
      // Render target is the `#statusbar` <div> in index.html,
      // NOT a child of the App's flex column. We use
      // createPortal so the StatusBar can sit at the page level
      // (after the Skeleton row, below it) without breaking the
      // flex-1 layout the Skeleton needs to fill its row. The
      // demo's chrome (header + skeleton row + statusbar) is the
      // flex column defined in index.html's `.demo-shell`.
      createPortal(StatusBar({
        engine,
        designerVersion: (DESIGNER_PKG as { version: string }).version,
        engineVersion: (ENGINE_PKG as { version: string }).version,
        theme,
        locale,
        nodeCount,
        selectionCount,
        preset: activePreset,
      }), document.getElementById('statusbar')!),
    ),
  );
}

// ---------------------------------------------------------------------------
// StatusBar — bottom-of-page chrome showing live engine state.
// Renders into a DOM portal (the `#statusbar` div in index.html)
// so it can sit OUTSIDE the Skeleton's flex container. i18n
// labels via `engine.t('status.*')` — flip the locale toggle in
// the topArea to see them change.
// ---------------------------------------------------------------------------
function StatusBar(props: {
  engine: ISapuEngine;
  engineVersion: string;
  designerVersion: string;
  theme: 'light' | 'dark';
  locale: string;
  nodeCount: number;
  selectionCount: number;
  preset: PresetId;
}): React.ReactElement {
  const t = (key: string): string => props.engine.t(key);
  return React.createElement(
    'div',
    { 'data-testid': 'statusbar-root', className: 'flex items-center gap-3 w-full' },
    React.createElement('span', null,
      React.createElement('span', { className: 'sb-key' }, `${t('status.engine')} `),
      React.createElement('span', { className: 'sb-value' }, `v${props.engineVersion}`),
    ),
    React.createElement('span', { className: 'sb-sep' }),
    React.createElement('span', null,
      React.createElement('span', { className: 'sb-key' }, `designer `),
      React.createElement('span', { className: 'sb-value' }, `v${props.designerVersion}`),
    ),
    React.createElement('span', { className: 'sb-sep' }),
    React.createElement('span', null,
      React.createElement('span', { className: 'sb-key' }, `${t('status.schema')} `),
      React.createElement('span', { className: 'sb-value' }, `${props.preset}.json`),
    ),
    React.createElement('span', { className: 'sb-sep' }),
    React.createElement('span', null,
      React.createElement('span', { className: 'sb-key' }, `${t('status.nodes')} `),
      React.createElement('span', { className: 'sb-value', 'data-testid': 'statusbar-nodes' }, String(props.nodeCount)),
    ),
    React.createElement('span', { className: 'sb-sep' }),
    React.createElement('span', null,
      React.createElement('span', { className: 'sb-key' }, `${t('status.selection')} `),
      React.createElement('span', { className: 'sb-value', 'data-testid': 'statusbar-selection' }, String(props.selectionCount)),
    ),
    React.createElement('span', { className: 'sb-sep' }),
    React.createElement('span', null,
      React.createElement('span', { className: 'sb-key' }, `${t('status.theme')} `),
      React.createElement('span', { className: 'sb-value', 'data-testid': 'statusbar-theme' }, props.theme),
    ),
    React.createElement('span', { className: 'sb-sep' }),
    React.createElement('span', null,
      React.createElement('span', { className: 'sb-key' }, `${t('status.locale')} `),
      React.createElement('span', { className: 'sb-value', 'data-testid': 'statusbar-locale' }, props.locale),
    ),
  );
}

/** Compact one-liner for an `IPublicTypeDragObject`. Used in the
 *  activity panel so the user can SEE what kind of drag just
 *  fired (palette item → '+Footer' vs canvas node → '↔Sidebar'
 *  vs opaque → 'Any?'). */
function describeDragObject(obj: IPublicTypeDragObject<IPublicTypeNodeLike>): string {
  if (obj.type === 'Node') return obj.nodes.length === 0 ? '∅' : `↔ ${obj.nodes[0]?.componentName ?? '?'}`;
  if (obj.type === 'NodeData') return `+ ${obj.data.componentName}`;
  return 'Any?';
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
  // Expose the engine on window for E2E tests + browser devtools.
  // (Production apps would NOT do this — it's a demo affordance.)
  (window as unknown as { __sapu_engine__: unknown }).__sapu_engine__ = engine;
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
(document.getElementById('undo') as HTMLButtonElement).onclick              = () => (window as any).__demo__.onUndo();
(document.getElementById('redo') as HTMLButtonElement).onclick              = () => (window as any).__demo__.onRedo();
