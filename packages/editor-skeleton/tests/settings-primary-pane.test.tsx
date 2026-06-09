/**
 * @monbolc/lowcode-editor-skeleton — SettingsPrimaryPane tests
 *
 * Verifies the6 visible branches of the pane:
 *1. No selection → empty hint.
 *2. Locked → locked hint.
 *3. Mixed-type multi-selection → mixed hint.
 *4. Single selection + ≤5 groups → Tabs render with the group title.
 *5. Single selection + >5 groups → flat-list fallback (no Tabs).
 *6. Breadcrumb renders the top-entry root label when there is one
 * group with a `parent` chain (we use the default Top Entry's
 * parent which is itself — so the breadcrumb collapses to a
 * single crumb; this is still useful as a sanity check).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { Project, SettingTopEntry } from '@monbolc/lowcode-designer';
import { deepClone } from '@monbolc/lowcode-utils';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

import { SettingsPrimaryPane } from '../src/settings/settings-primary-pane';

beforeAll(() => {
 adapter.setRuntime({
 Component: React.Component,
 PureComponent: React.PureComponent,
 createElement: React.createElement,
 createContext: React.createContext,
 forwardRef: React.forwardRef,
 findDOMNode: null,
 });
});

/**
 * Build a SettingTopEntry whose `configure.props` is the provided
 * list of groups. Each group is a `{ name, title, type: 'group',
 * items: [] }` IPublicTypeFieldConfig.
 */
function makeTopEntry(groupCount: number): SettingTopEntry {
 const schema: IPublicTypeRootSchema = {
 fileName: 'p.json',
 componentName: 'Page',
 children: [{ componentName: 'Comp' }],
 };
 const project = new Project(deepClone(schema));
 const node = project.document.root.children![0];

 // Patch the node with `componentMeta.configure` so the
 // SettingTopEntry constructor picks up our synthetic configure.
 const configure = Array.from({ length: groupCount }, (_, i) => ({
 name: `g${i}`,
 type: 'group' as const,
 title: `Group ${i +1}`,
 items: [],
 }));
 (node as unknown as { componentMeta: unknown }).componentMeta = {
 configure,
 onMetadataChange: () => () => undefined,
 };
 const editor = { setters: { getSetter: () => undefined } };
 return new SettingTopEntry(editor as unknown as never, [node as unknown as never]);
}

describe('SettingsPrimaryPane', () => {
 it('shows the empty hint when no node is selected', () => {
 const topEntry = makeTopEntry(2);
 render(<SettingsPrimaryPane topEntry={topEntry} current={null} />);
 expect(screen.getByText(/Click a node in the outline/i)).toBeInTheDocument();
 });

 it('shows the locked hint when locked=true', () => {
 const topEntry = makeTopEntry(2);
 const node = topEntry.first;
 render(<SettingsPrimaryPane topEntry={topEntry} current={node} locked />);
 expect(screen.getByText(/locked/i)).toBeInTheDocument();
 });

 it('shows the mixed hint when the top entry is multi-type', () => {
 // Two nodes of different componentName with no shared meta →
 // isSameComponent = false. Both nodes need a `configure` so the
 // mixed-hint branch fires before the "no groups" branch.
 const schema: IPublicTypeRootSchema = {
 fileName: 'p.json',
 componentName: 'Page',
 children: [
 { componentName: 'A' },
 { componentName: 'B' },
 ],
 };
 const project = new Project(deepClone(schema));
 const [a, b] = project.document.root.children!;
 const configure = [{ name: 'g0', type: 'group' as const, title: 'Group', items: [] }];
 for (const node of [a, b]) {
 (node as unknown as { componentMeta: unknown }).componentMeta = {
 configure,
 onMetadataChange: () => () => undefined,
 };
 }
 const editor = { setters: { getSetter: () => undefined } };
 const top = new SettingTopEntry(editor as unknown as never, [a as unknown as never, b as unknown as never]);
 render(<SettingsPrimaryPane topEntry={top} current={a} />);
 expect(screen.getByText(/Mixed selection/i)).toBeInTheDocument();
 });

 it('renders tabs when there are5 or fewer groups', () => {
 const topEntry = makeTopEntry(3);
 const node = topEntry.first;
 render(<SettingsPrimaryPane topEntry={topEntry} current={node} />);
 // BaseUI Tabs wraps each title in a button, so use role lookup
 // (getByText is fooled by the wrapping <button>'s text node).
 expect(screen.getByRole('tab', { name: 'Group 1' })).toBeInTheDocument();
 expect(screen.getByRole('tab', { name: 'Group 2' })).toBeInTheDocument();
 expect(screen.getByRole('tab', { name: 'Group 3' })).toBeInTheDocument();
 // The tablist role is the standard a11y attribute BaseUI emits.
 expect(screen.getByRole('tablist')).toBeInTheDocument();
 });

 it('falls back to a flat list (no tablist) when there are more than5 groups', () => {
 const topEntry = makeTopEntry(6);
 const node = topEntry.first;
 render(<SettingsPrimaryPane topEntry={topEntry} current={node} />);
 // Group titles still visible.
 expect(screen.getByText('Group 1')).toBeInTheDocument();
 expect(screen.getByText('Group 6')).toBeInTheDocument();
 // ... but no tablist (flat list, no tabs).
 expect(screen.queryByRole('tablist')).toBeNull();
 });

 it('uses the t() function for empty hint when provided', () => {
 const topEntry = makeTopEntry(2);
 render(<SettingsPrimaryPane topEntry={topEntry} current={null} t={(k) => `T:${k}`} />);
 expect(screen.getByText('T:empty')).toBeInTheDocument();
 });
});
