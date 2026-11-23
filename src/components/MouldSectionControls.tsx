import { useId } from 'react';
import { MOULD_SLIDERS, withColumns } from '../state/mould';
import type { FixedPosition, MouldWall, SectionLayout } from '../scene/mouldLayout';
import type { MouldSectionDef } from '../scene/mouldWalls';

interface Props {
  def: MouldSectionDef<string>;
  /** the group's heading */
  label: string;
  wall: MouldWall;
  layout: SectionLayout;
  /** the room's spacing, cm */
  roomSpacing: number;
  on: boolean;
  onChange: (wall: MouldWall) => void;
}

/** a range of whole cm from a limit in cm, never with its max below its min */
const span = (min: number, max: number) => {
  const lo = Math.ceil(min - 1e-6);
  return { min: lo, max: Math.max(lo, Math.floor(max + 1e-6)) };
};

const POSITIONS: { id: FixedPosition; name: string }[] = [
  { id: 'even', name: 'Even' },
  { id: 'bed', name: 'Centred on bed' },
  { id: 'custom', name: 'Custom' },
];

/** The controls for one wall section: spacing, columns, and the one fixed column. */
export function MouldSectionControls({ def, label, wall, layout, roomSpacing, on, onChange }: Props) {
  const id = useId();
  const { limits, fixed } = layout;
  const set = (patch: Partial<MouldWall>) => onChange({ ...wall, ...patch });
  const spacing = wall.spacing ?? roomSpacing;
  const spacingRange = { min: MOULD_SLIDERS.spacing.min, max: Math.max(MOULD_SLIDERS.spacing.min, limits.spacingMax) };
  const cols = MOULD_SLIDERS.columns;
  const columnsMin = def.minColumns;
  const width = fixed && limits.fixedWidth ? span(limits.fixedWidth.min, limits.fixedWidth.max) : null;
  const centre = fixed && limits.fixedCentre ? span(limits.fixedCentre.min, limits.fixedCentre.max) : null;
  const drawnCentre = fixed ? Math.round((fixed.centre - def.run[0]) * 100) : 0;
  const centreForced = !!limits.fixedCentre && limits.fixedCentre.min >= limits.fixedCentre.max - 1e-6;
  const shown = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, Math.round(v)));
  const positions = POSITIONS.filter((p) => p.id !== 'bed' || def.bedAnchor);
  return (
    <div className={on ? 'grp' : 'grp off'} data-testid={`mould-${def.key}`} role="group" aria-labelledby={id}>
      <h3 id={id}>{label}</h3>
      <label className="sl">
        Spacing <b>{spacing} cm</b>
        <input
          type="range" min={spacingRange.min} max={spacingRange.max} step={MOULD_SLIDERS.spacing.step} value={spacing} disabled={!on}
          onChange={(e) => set({ spacing: Number(e.target.value) })}
        />
      </label>
      {wall.spacing !== null && (
        <button type="button" className="chip" disabled={!on} onClick={() => set({ spacing: null })}>
          <span>Use room spacing</span>
        </button>
      )}
      <label className="sl">
        Columns <b>{layout.count < wall.columns ? `${wall.columns} (${layout.count} fit)` : wall.columns}</b>
        <input
          type="range" min={columnsMin} max={cols.max} step={cols.step} value={wall.columns} disabled={!on}
          onChange={(e) => onChange(withColumns(wall, Number(e.target.value)))}
        />
      </label>
      <label className="sl">
        Fixed column
        <select value={wall.fixedColumn} disabled={!on} onChange={(e) => set({ fixedColumn: Number(e.target.value) })}>
          <option value={0}>None</option>
          {Array.from({ length: wall.columns }, (_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>
      </label>
      {width && fixed && (
        <label className="sl">
          Fixed width <b>{shown(fixed.width * 100, width)} cm</b>
          <input
            type="range" min={width.min} max={width.max} step={1} value={shown(fixed.width * 100, width)}
            disabled={!on || width.min >= width.max} onChange={(e) => set({ fixedWidth: Number(e.target.value) })}
          />
        </label>
      )}
      {wall.fixedColumn > 0 && (
        <div className="chips mt6" role="group" aria-label="Position">
          {positions.map((p) => (
            <button
              key={p.id} type="button" className="chip" disabled={!on || centreForced} aria-pressed={wall.fixedPosition === p.id}
              onClick={() => set(p.id === 'custom' ? { fixedPosition: 'custom', ...(fixed ? { fixedCentre: drawnCentre } : {}) } : { fixedPosition: p.id })}
            >
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
      {wall.fixedPosition === 'custom' && centre && (
        <label className="sl">
          Centre <b>{shown(drawnCentre, centre)} cm</b>
          <input
            type="range" min={centre.min} max={centre.max} step={1} value={shown(drawnCentre, centre)}
            disabled={!on || centre.min >= centre.max} onChange={(e) => set({ fixedCentre: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
}
