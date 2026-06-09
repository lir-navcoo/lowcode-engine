/**
 * @monbolc/lowcode-designer — setting/ barrel
 * Ali-mirror Phase D.S1: barrel re-export of the setting tree sub-scope.
 *
 * S1 ships the `ISettingEntry` + `ISettingField` interface contracts
 * (setting-entry-type.ts) and the `Transducer` value-object (utils.ts).
 * S2–S4 will add `SettingPropEntry`, `SettingField`, and `SettingTopEntry`
 * — those exports will be appended here.
 */
export * from './setting-entry-type';
export * from './utils';
