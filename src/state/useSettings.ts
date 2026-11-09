import { useCallback, useEffect, useState } from 'react';
import { applyPatch, loadSettings, saveSettings, type Settings, type SettingsPatch } from './settings';

export type Update = (patch: SettingsPatch) => void;

/** App settings, loaded from and persisted to localStorage. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  useEffect(() => saveSettings(settings), [settings]);
  const update: Update = useCallback((patch) => setSettings((s) => applyPatch(s, patch)), []);
  return [settings, update] as const;
}
