import { MOULD_COLOURS } from '../data/catalog';
import { SLIDERS, type BedroomSettings, type Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';

interface Props {
  settings: Settings;
  update: Update;
}

const WALLS = [
  { key: 'mouldBedWall', label: 'Bed wall' },
  { key: 'mouldDresserWall', label: 'Dresser wall' },
] as const;

const SLIDER_LABELS = [
  { key: 'mouldGap', label: 'Column spacing' },
  { key: 'mouldCentre', label: 'Centre width' },
  { key: 'mouldSide', label: 'Side width' },
] as const;

export function MouldingSection({ settings, update }: Props) {
  const b = settings.bedroom;
  const set = (patch: Partial<BedroomSettings>) => update({ bedroom: patch });
  const bedOn = b.mouldBedWall === 'on';
  return (
    <section>
      <h2>Wall moulding</h2>
      <div className="grp">
        <h3>Colour</h3>
        <ChipGroup
          label="Moulding colour"
          options={MOULD_COLOURS}
          value={b.mouldColour}
          onChange={(id) => set({ mouldColour: id as BedroomSettings['mouldColour'] })}
        />
      </div>
      <div className="grp">
        <h3>Show on</h3>
        <div className="chips" role="group" aria-label="Show moulding on">
          {WALLS.map(({ key, label }) => {
            const on = b[key] === 'on';
            return (
              <button key={key} type="button" className="chip" aria-pressed={on} onClick={() => set({ [key]: on ? 'off' : 'on' })}>
                <Icon name={on ? 'check' : 'plus'} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={bedOn ? 'grp' : 'grp off'} data-testid="bed-wall-layout">
        <h3>Bed wall layout</h3>
        {SLIDER_LABELS.map(({ key, label }) => (
          <label className="sl" key={key}>
            {label} <b>{b[key]} cm</b>
            <input
              type="range"
              {...SLIDERS[key]}
              value={b[key]}
              disabled={!bedOn}
              onChange={(e) => set({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
