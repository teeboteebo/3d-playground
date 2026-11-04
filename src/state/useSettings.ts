import { useCallback, useEffect, useState } from 'react';
import { loadSettings, saveSettings, type Settings } from './settings';

/** App settings, loaded from and persisted to localStorage. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  useEffect(() => saveSettings(settings), [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  return [settings, update] as const;
}
