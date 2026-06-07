/**
 * Hello Sapu — Vite demo entry
 *
 * Wires up the real L4 `Skeleton` + L3 `Designer` + L2 `OutlinePane` +
 * L2.5 `plugin-setters` against a hand-rolled component registry.
 *
 * Run via `yarn demo` at the repo root, then open http://localhost:5173.
 *
 * What this demo proves:
 *   - L0–L4 stack composes: bootstrap React, build a Project, mount
 *     a Skeleton, render through the simulator.
 *   - L2.5 setters are wired into the L4 settings panel (right pane).
 *   - A host can register a CUSTOM setter and have the L4 panel use
 *     it for a specific (component, prop) — see the
 *     "Use custom setter" toggle in the toolbar and the `HexColor`
 *     setter defined below.
 */
import './styles.css';

import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { setupReactRenderer } from '@monbolc/lowcode-react-renderer';
import { Project } from '@monbolc/lowcode-designer';
import { Skeleton } from '@monbolc/lowcode-editor-skeleton';
import { Resource, Workspace } from '@monbolc/lowcode-workspace';
import type { OutlinePane } from '@monbolc/lowcode-plugin-outline-pane';
import {
  registerSetter,
  type SetterComponent,
  type SetterProps,
} from '@monbolc/lowcode-plugin-setters';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

// 1. Install React 19.2.7 runtime.
setupReactRenderer();

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
  Header:  (p) => React.createElement('header',  { ...p, style: { ...p.style, padding: 12, background: '#dbeafe', borderRadius: 4, marginBottom: 8 } }, '🏠 Header'),
  Body:    (p) => React.createElement('section', { ...p, style: { ...p.style, display: 'flex', gap: 8 } }, p.children),
  Sidebar: (p) => React.createElement('aside',   { ...p, style: { ...p.style, width: 200, padding: 12, background: p.bg ?? '#fef3c7', borderRadius: 4 } }, '📚 Sidebar'),
  Main:    (p) => React.createElement('main',    { ...p, style: { ...p.style, flex: 1, padding: 12, background: '#dcfce7', borderRadius: 4 } }, '📄 Main'),
  Footer:  (p) => React.createElement('footer',  { ...p, style: { ...p.style, padding: 12, background: '#fce7f3', borderRadius: 4, marginTop: 8 } }, '🦶 Footer'),
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
  ],
};

// ---------------------------------------------------------------------------
// 5. The demo React app.
// ---------------------------------------------------------------------------
function App() {
  const [schema, setSchema] = useState<IPublicTypeRootSchema>(initialSchema as IPublicTypeRootSchema);
  const [project] = useState(() => new Project(initialSchema as IPublicTypeRootSchema));
  // The Skeleton owns the OutlinePane internally. We capture the
  // reference via `onPaneReady` so the toolbar buttons can call
  // pane-level actions (rename, expand, select) directly.
  const paneRef = useRef<OutlinePane | null>(null);
  // When ON, the host has registered the custom `HexColor` setter and
  // told the L4 settings panel to use it for `Sidebar.bg`. Toggling
  // OFF unregisters it; the L4 panel falls back to the inferred
  // `Input` setter for that prop.
  const [customOn, setCustomOn] = useState(false);

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
      ],
    } as IPublicTypeRootSchema);
  };
  const onToggleCustom = () => setCustomOn((v) => !v);

  // L5 demo: open a SECOND editing session in a sibling div. Each
  // <Skeleton> owns its own Project + Workspace. The two sessions
  // share the `components` registry (so the simulator can render
  // both), but selection / schema state is fully independent —
  // clicking a node in one outline does NOT affect the other.
  //
  // The second doc's host div is empty until the button is clicked,
  // so the second <Skeleton> only mounts on demand (preserves the
  // "single Skeleton per mount" stance for normal usage).
  const [secondRoot, setSecondRoot] = useState<Root | null>(null);
  const [secondActive, setSecondActive] = useState(false);
  const secondHostRef = useRef<HTMLDivElement | null>(null);
  const onOpenSecond = () => {
    if (secondActive) return; // idempotent — second doc mounts once
    const host = document.getElementById('skeleton-2');
    if (!host) return;
    secondHostRef.current = host as HTMLDivElement;
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
    ws.addResource(resource); // ws.events on 'windowActivated' is unused here — the L4 panel reads the project directly.
    void ws; // keep the workspace reference live (sapu stance: WS is the data side; L4 reads the project)
    const root2 = createRoot(host as Element);
    root2.render(
      React.createElement(Skeleton as any, {
        project: project2,
        components,
      }),
    );
    setSecondRoot(root2);
    setSecondActive(true);
  };

  // Expose handlers globally so the toolbar buttons (outside the React tree)
  // can call them.
  (window as any).__demo__ = { onAdd, onRename, onReset, onToggleCustom, onOpenSecond, secondRoot: () => secondRoot };

  return React.createElement(Skeleton as any, {
    project,
    components,
    onPaneReady: (p: OutlinePane) => { paneRef.current = p; },
    setterConfig,
  });
}

// ---------------------------------------------------------------------------
// 6. Mount.
// ---------------------------------------------------------------------------
const root = createRoot(document.getElementById('skeleton')!);
root.render(React.createElement(App));

// ---------------------------------------------------------------------------
// 7. Toolbar wiring (vanilla DOM, no React).
// ---------------------------------------------------------------------------
(document.getElementById('add-footer') as HTMLButtonElement).onclick        = () => (window as any).__demo__.onAdd();
(document.getElementById('rename-page') as HTMLButtonElement).onclick       = () => (window as any).__demo__.onRename();
(document.getElementById('reset') as HTMLButtonElement).onclick             = () => (window as any).__demo__.onReset();
(document.getElementById('toggle-custom') as HTMLButtonElement).onclick    = () => (window as any).__demo__.onToggleCustom();
(document.getElementById('open-second') as HTMLButtonElement).onclick       = () => (window as any).__demo__.onOpenSecond();
