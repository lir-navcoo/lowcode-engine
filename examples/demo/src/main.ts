/**
 * Hello Sapu — Vite demo entry
 *
 * Wires up the real L4 `Skeleton` + L3 `Designer` + L2 `OutlinePane`
 * against a hand-rolled component registry. Run via `yarn demo` at
 * the repo root, then open http://localhost:5173.
 */
import './styles.css';

import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { setupReactRenderer } from '@monbolc/lowcode-react-renderer';
import { Project } from '@monbolc/lowcode-designer';
import { Skeleton } from '@monbolc/lowcode-editor-skeleton';
import type { OutlinePane } from '@monbolc/lowcode-plugin-outline-pane';

// 1. Install React 19.2.7 runtime.
setupReactRenderer();

// 2. Component registry — these are what the canvas simulator renders.
const components: Record<string, React.FC<any>> = {
  Header:  (p) => React.createElement('header',  { ...p, style: { ...p.style, padding: 12, background: '#dbeafe', borderRadius: 4, marginBottom: 8 } }, '🏠 Header'),
  Body:    (p) => React.createElement('section', { ...p, style: { ...p.style, display: 'flex', gap: 8 } }, p.children),
  Sidebar: (p) => React.createElement('aside',   { ...p, style: { ...p.style, width: 200, padding: 12, background: '#fef3c7', borderRadius: 4 } }, '📚 Sidebar'),
  Main:    (p) => React.createElement('main',    { ...p, style: { ...p.style, flex: 1, padding: 12, background: '#dcfce7', borderRadius: 4 } }, '📄 Main'),
  Footer:  (p) => React.createElement('footer',  { ...p, style: { ...p.style, padding: 12, background: '#fce7f3', borderRadius: 4, marginTop: 8 } }, '🦶 Footer'),
};

// 3. Initial schema. (Keys are assigned at runtime by the
// DocumentModel when none is provided.)
const initialSchema = {
  fileName: 'home.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header', props: { className: 'header' } },
    { componentName: 'Body', props: { className: 'body' }, children: [
      { componentName: 'Sidebar', props: { className: 'sidebar' } },
      { componentName: 'Main',    props: { className: 'main'    } },
    ] },
  ],
};

// 4. The demo React app. Owns the Project (single source of truth)
// and re-mounts the Skeleton whenever the schema changes.
function App() {
  const [schema, setSchema] = useState(initialSchema);
  const [project] = useState(() => new Project(schema));
  // The Skeleton owns the OutlinePane internally. We capture the
  // reference via `onPaneReady` so the toolbar buttons can call
  // pane-level actions (rename, expand, select) directly — these
  // mutate display state, not the schema, so they don't go through
  // setSchema / project.load.
  const paneRef = useRef<OutlinePane | null>(null);

  // Push schema into the project AFTER render, never during it.
  // (Calling project.load inside the render body fires `rootChanged`,
  // which triggers setState on the Skeleton / OutlineView child during
  // App's render — React 19 error: "Cannot update a component while
  // rendering a different component".)
  useEffect(() => {
    project.load(schema);
  }, [schema, project]);

  const onAdd = () => {
    setSchema((s) => ({
      ...s,
      children: [...s.children, { componentName: 'Footer', props: { className: 'footer' } }],
    }));
  };
  const onRename = () => {
    // Ali-style: rename the display label, NOT the componentName.
    // Renaming componentName would break the canvas (the renderer
    // can't find the registered 'App' component). Renaming the
    // label only mutates the outline tree's display title.
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
          { componentName: 'Sidebar', props: { className: 'sidebar' } },
          { componentName: 'Main',    props: { className: 'main'    } },
        ] },
      ],
    });
  };

  // Expose handlers globally so the toolbar buttons (outside the React tree)
  // can call them.
  (window as any).__demo__ = { onAdd, onRename, onReset };

  return React.createElement(Skeleton, {
    project,
    components,
    onPaneReady: (p: OutlinePane) => { paneRef.current = p; },
  });
}

// 5. Mount.
const root = createRoot(document.getElementById('skeleton')!);
root.render(React.createElement(App));

// 6. Toolbar wiring.
(document.getElementById('add-footer') as HTMLButtonElement).onclick   = () => (window as any).__demo__.onAdd();
(document.getElementById('rename-page') as HTMLButtonElement).onclick  = () => (window as any).__demo__.onRename();
(document.getElementById('reset') as HTMLButtonElement).onclick        = () => (window as any).__demo__.onReset();
