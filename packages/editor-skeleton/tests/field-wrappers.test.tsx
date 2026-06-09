/**
 * @monbolc/lowcode-editor-skeleton — field wrapper tests
 *
 * Verifies the5 setter field wrappers. The wrappers receive a
 * `IPublicTypeFieldConfig` + an `onChange` callback. Each test:
 *
 *1. Renders the wrapper.
 *2. Confirms the rendered shell matches (label visible).
 *3. Performs one user interaction (typing / blur) and confirms
 * `onChange` was called with the expected new field.
 *
 * Note: `SetterTypeField` requires the built-in setters to be
 * registered before it renders the dropdown; we call
 * `registerBuiltInSetters()` in `beforeAll`.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { registerBuiltInSetters } from '@monbolc/lowcode-plugin-setters';
import type { IPublicTypeFieldConfig } from '@monbolc/lowcode-types';

import {
 ExtraPropsField,
 TitleField,
 DescriptionField,
 SetterTypeField,
 DefaultValueField,
} from '../src/field/field-wrappers';

beforeAll(() => {
 adapter.setRuntime({
 Component: React.Component,
 PureComponent: React.PureComponent,
 createElement: React.createElement,
 createContext: React.createContext,
 forwardRef: React.forwardRef,
 findDOMNode: null,
 });
 registerBuiltInSetters();
});

function makeField(overrides: Partial<IPublicTypeFieldConfig> = {}): IPublicTypeFieldConfig {
 return {
 name: 'foo',
 title: 'Foo',
 setter: 'Input',
 ...overrides,
 };
}

describe('ExtraPropsField', () => {
 it('renders with the JSON label and commits valid JSON on blur', () => {
 const onChange = vi.fn();
 const field = makeField({ extraProps: { min:0 } });
 render(<ExtraPropsField field={field} onChange={onChange} />);
 expect(screen.getByText(/extraProps/i)).toBeInTheDocument();
 const ta = document.querySelector('textarea') as HTMLTextAreaElement;
 expect(ta.value).toContain('"min"');
 fireEvent.change(ta, { target: { value: '{"min":10,"max":99}' } });
 fireEvent.blur(ta);
 expect(onChange).toHaveBeenCalledTimes(1);
 const arg = onChange.mock.calls[0][0] as IPublicTypeFieldConfig;
 expect(arg.extraProps).toEqual({ min:10, max:99 });
 });
});

describe('TitleField', () => {
 it('renders with the title label and updates via BaseUI Input onChange', () => {
 const onChange = vi.fn();
 const field = makeField({ title: 'Original' });
 render(<TitleField field={field} onChange={onChange} />);
 expect(screen.getByText(/title/i)).toBeInTheDocument();
 const input = screen.getByDisplayValue('Original') as HTMLInputElement;
 fireEvent.change(input, { target: { value: 'Renamed' } });
 expect(onChange).toHaveBeenCalledTimes(1);
 const arg = onChange.mock.calls[0][0] as IPublicTypeFieldConfig;
 expect(arg.title).toBe('Renamed');
 });
});

describe('DescriptionField', () => {
 it('renders with the description label and commits on blur', () => {
 const onChange = vi.fn();
 const field = makeField({ description: 'old' });
 render(<DescriptionField field={field} onChange={onChange} />);
 expect(screen.getByText(/description/i)).toBeInTheDocument();
 const ta = document.querySelector('textarea') as HTMLTextAreaElement;
 fireEvent.change(ta, { target: { value: 'new description' } });
 fireEvent.blur(ta);
 expect(onChange).toHaveBeenCalledTimes(1);
 const arg = onChange.mock.calls[0][0] as IPublicTypeFieldConfig;
 expect(arg.description).toBe('new description');
 });
});

describe('SetterTypeField', () => {
 it('shows the current setter name when it is registered', () => {
 const field = makeField({ setter: 'Input' });
 render(<SetterTypeField field={field} onChange={() => undefined} />);
 expect(screen.getByText(/setter/i)).toBeInTheDocument();
 expect(screen.getByText('Input')).toBeInTheDocument();
 });

 it('shows the unknown-setter placeholder when the name is not registered', () => {
 const field = makeField({ setter: 'NoSuchSetter' });
 render(<SetterTypeField field={field} onChange={() => undefined} />);
 expect(screen.getByText(/Unknown setter: NoSuchSetter/i)).toBeInTheDocument();
 });
});

describe('DefaultValueField', () => {
 it('renders the JSON label and commits valid JSON on blur', () => {
 const onChange = vi.fn();
 const field = makeField({ defaultValue:42 });
 render(<DefaultValueField field={field} onChange={onChange} />);
 expect(screen.getByText(/defaultValue/i)).toBeInTheDocument();
 const ta = document.querySelector('textarea') as HTMLTextAreaElement;
 fireEvent.change(ta, { target: { value: '99' } });
 fireEvent.blur(ta);
 expect(onChange).toHaveBeenCalledTimes(1);
 const arg = onChange.mock.calls[0][0] as IPublicTypeFieldConfig;
 expect(arg.defaultValue).toBe(99);
 });
});
