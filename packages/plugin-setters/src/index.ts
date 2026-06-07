/**
 * @monbolc/lowcode-plugin-setters — barrel export
 *
 * SapuLowcodeEngine L2 setters. Call `registerBuiltInSetters()` once
 * at boot to install the 7 default setters; then `pickSetter(field)`
 * to look one up by name.
 */

export {
  registerSetter,
  getSetter,
  pickSetter,
  resolveSetterName,
  withLabel,
  BUILT_IN_SETTERS,
} from './registry';
export type { SetterComponent, SetterProps, SetterDescriptor, SetterType } from './registry';

export { registerBuiltInSetters, Input, TextArea, Number, Switch, Select, ColorPicker, Slider } from './built-in';
