/**
 * @monbolc/lowcode-editor-skeleton — MaterialPane tests
 *
 * Verifies:
 * - Empty categories list → documented empty hint.
 * - Non-empty categories → rows render with the componentName as
 * the visible label.
 * - Search filters by `componentName` substring (case-insensitive).
 * - Search filters by `title` substring.
 * - Search filters by `keywords` (any match is enough).
 * - Clicking a row fires the `onPick` callback with the meta.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import type {
 IPublicTypeComponentCategory,
 IPublicTypeComponentSchema,
} from '@monbolc/lowcode-types';

import { MaterialPane } from '../src/material/material-pane';

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

function meta(name: string, overrides: Partial<IPublicTypeComponentSchema> = {}): IPublicTypeComponentSchema {
 return {
 componentName: name,
 title: name,
 ...overrides,
 };
}

const categories: IPublicTypeComponentCategory[] = [
 {
 id: 'c1',
 title: 'Layout',
 components: [
 meta('Button', { title: 'Button', keywords: ['btn', 'action'] }),
 meta('Div', { title: 'Div', keywords: ['box', 'container'] }),
 ],
 },
 {
 id: 'c2',
 title: 'Form',
 components: [meta('Input', { title: 'Text Input' })],
 },
];

describe('MaterialPane', () => {
 it('shows the empty hint when no categories are provided', () => {
 render(<MaterialPane categories={[]} />);
 expect(screen.getByText(/No components registered/i)).toBeInTheDocument();
 });

 it('renders one row per component when categories are non-empty', () => {
 render(<MaterialPane categories={categories} />);
 // Each row's label is the component's `title` (with `componentName` as
 // the title-attribute fallback). The third component has `title:
 // 'Text Input'`, not 'Input'.
 expect(screen.getByText('Button')).toBeInTheDocument();
 expect(screen.getByText('Div')).toBeInTheDocument();
 expect(screen.getByText('Text Input')).toBeInTheDocument();
 // The category titles are in the collapsible trigger.
 expect(screen.getByText('Layout')).toBeInTheDocument();
 expect(screen.getByText('Form')).toBeInTheDocument();
 });

 it('filters by componentName substring (case-insensitive)', () => {
 render(<MaterialPane categories={categories} />);
 const input = screen.getByPlaceholderText(/Search components/i) as HTMLInputElement;
 fireEvent.change(input, { target: { value: 'div' } });
 expect(screen.queryByText('Button')).toBeNull();
 expect(screen.getByText('Div')).toBeInTheDocument();
 expect(screen.queryByText('Input')).toBeNull();
 });

 it('filters by title substring', () => {
 render(<MaterialPane categories={categories} />);
 const input = screen.getByPlaceholderText(/Search components/i) as HTMLInputElement;
 fireEvent.change(input, { target: { value: 'Text Input' } });
 expect(screen.queryByText('Button')).toBeNull();
 expect(screen.queryByText('Div')).toBeNull();
 expect(screen.getByText('Text Input')).toBeInTheDocument();
 });

 it('filters by keywords (any match is enough)', () => {
 render(<MaterialPane categories={categories} />);
 const input = screen.getByPlaceholderText(/Search components/i) as HTMLInputElement;
 fireEvent.change(input, { target: { value: 'btn' } });
 expect(screen.getByText('Button')).toBeInTheDocument();
 expect(screen.queryByText('Div')).toBeNull();
 expect(screen.queryByText('Input')).toBeNull();
 });

 it('fires onPick when a row is clicked', () => {
 const onPick = vi.fn();
 render(<MaterialPane categories={categories} onPick={onPick} />);
 const row = screen.getByText('Button').closest('[role="button"]') as HTMLElement;
 fireEvent.click(row);
 expect(onPick).toHaveBeenCalledTimes(1);
 expect(onPick.mock.calls[0][0].componentName).toBe('Button');
 });

 it('shows a "no matches" hint when the query has zero hits but categories exist', () => {
 render(<MaterialPane categories={categories} />);
 const input = screen.getByPlaceholderText(/Search components/i) as HTMLInputElement;
 fireEvent.change(input, { target: { value: 'zzzz-no-match' } });
 expect(screen.getByText(/No components match/i)).toBeInTheDocument();
 });
});
