import type { ReactNode } from 'react';
import type { Steps } from '../state/useSettings';
import { Icon } from './Icon';

/** Undo and redo, at the foot of the panel where they stay in reach on every page. */
export function StepsBar({ steps, children }: { steps: Steps; children?: ReactNode }) {
  return (
    <div className="panel-foot" role="group" aria-label="Design controls">
      <button type="button" aria-label="Undo" title="Undo (⌘Z)" disabled={!steps.canUndo} onClick={steps.undo}>
        <Icon name="undo" />
        <span aria-hidden="true">Undo</span>
      </button>
      <button type="button" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!steps.canRedo} onClick={steps.redo}>
        <Icon name="redo" />
        <span aria-hidden="true">Redo</span>
      </button>
      {children}
    </div>
  );
}
