import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { change, redo, startHistory, undo, type History } from './history';
import { loadSettings, saveSettings, type SettingsPatch } from './settings';

export type Update = (patch: SettingsPatch) => void;

/** undo and redo over the design (not the open room or the time of day) */
export interface Steps {
  canUndo: boolean;
  canRedo: boolean;
  undo(): void;
  redo(): void;
}

type Action = { type: 'change'; patch: SettingsPatch; at: number } | { type: 'undo' } | { type: 'redo' };

function reduce(h: History, a: Action): History {
  if (a.type === 'undo') return undo(h);
  if (a.type === 'redo') return redo(h);
  return change(h, a.patch, a.at);
}

/** App settings, loaded from and persisted to localStorage, with undo and redo. */
export function useSettings() {
  const [history, dispatch] = useReducer(reduce, undefined, () => startHistory(loadSettings()));
  const settings = history.present;
  useEffect(() => saveSettings(settings), [settings]);
  const update: Update = useCallback((patch) => dispatch({ type: 'change', patch, at: Date.now() }), []);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const steps: Steps = useMemo(
    () => ({ canUndo, canRedo, undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }) }),
    [canUndo, canRedo],
  );
  return [settings, update, steps] as const;
}
