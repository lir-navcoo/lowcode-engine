# SapuLowcodeEngine Documentation

> **From-scratch rewrite** of `alibaba/lowcode-engine` v1.3.2 under the `@monbolc` npm scope. 14 packages, L0–L7 complete, 400 tests passing, zero `@alilc`/`@alifd`/`@supu` references in source.

## Index

| Doc | Purpose |
|---|---|
| [HANDOVER.md](HANDOVER.md) | **接手人入口** — 当前状态快照、2.2.0 发布步骤、关键命令、约定 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | L0–L7 layering, dependency graph, design principles, the React injection boundary |
| [COMPARISON-WITH-ALI.md](COMPARISON-WITH-ALI.md) | sapu package ↔ `alibaba/lowcode-engine` package mapping, API differences, scope slimming |
| [ROADMAP.md](ROADMAP.md) | Current state (L0–L7 done), per-layer status, deferred work |
| [PLAYWRIGHT.md](PLAYWRIGHT.md) | P2.5 Playwright E2E suite — 5 specs, how to add a new one, selector conventions |
| [packages/types.md](packages/types.md) | L0 — core type system |
| [packages/ignitor.md](packages/ignitor.md) | L0 — **DEPRECATED**; use `@monbolc/lowcode-engine` instead |
| [packages/utils.md](packages/utils.md) | L1 — pure utility functions |
| [packages/editor-core.md](packages/editor-core.md) | L2 — DI container, i18n, plugin manager |
| [packages/plugin-command.md](packages/plugin-command.md) | L2 — command pattern + undo/redo |
| [packages/renderer-core.md](packages/renderer-core.md) | L2 — framework-agnostic renderer abstraction |
| [packages/plugin-outline-pane.md](packages/plugin-outline-pane.md) | L2 — outline tree (uses `react-arborist`) |
| [packages/plugin-setters.md](packages/plugin-setters.md) | L2.5 — BaseUI setter registry |
| [packages/react-renderer.md](packages/react-renderer.md) | L3 — React 19.2.7 runtime injection |
| [packages/designer.md](packages/designer.md) | L3 — DocumentModel, Project, Dragon, commands |
| [packages/editor-skeleton.md](packages/editor-skeleton.md) | L4 — 3-pane editor UI (uses `react-resizable-panels`) |
| [packages/workspace.md](packages/workspace.md) | L5 — `Resource`, `EditorWindow`, `Workspace` (single-window stance) |
| [packages/shell.md](packages/shell.md) | L6 — `SapuEngine`, `SapuErrorBoundary`, `ShellI18n`, `EngineEventBus` |
| [packages/engine.md](packages/engine.md) | L7 — `init(container, options)`, `createDefaultPreset`, `setTheme` |

## What this docs/ folder is for

This folder is the **primary source of truth for sapu-lowcode-engine**. Memory files in `~/.claude/projects/.../memory/` hold the "what's the state right now" snapshot, but for *how each piece actually works* (exports, types, patterns, gotchas), read these docs.

**Update rule** (per [[feedback-update-memory-after-changes]]): every time you change code, config, package state, or project status, update the relevant doc in the same turn. See [docs-update-procedure.md](https://memory-location) for the per-change update checklist.

## Quick reference

- **Repo path**: `/Users/lirui/Documents/lowcode-engine/sapu-lowcode-engine/`
- **Brand**: SapuLowcodeEngine
- **NPM scope**: `@monbolc`
- **React version**: 19.2.7 (peerDependency, optional; only L3+)
- **TypeScript**: 5.4
- **Build**: `tsc -p tsconfig.json` (CJS) + `tsc -p tsconfig.esm.json && node ../../scripts/add-js-extensions.mjs es` (ESM with `.js` extensions)
- **Test**: `yarn test` (vitest 2.1, happy-dom, @testing-library/react 16) — **400 tests / 42 files, 0 failures**
- **Typecheck**: `yarn typecheck` — **0 errors** across all 14 packages + demo
- **Reference upstream** (for context, not active development): `../ali-lowcode-engine/`

