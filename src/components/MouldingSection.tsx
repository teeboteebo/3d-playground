import { MOULD_COLOURS } from '../data/catalog';
import { SLIDERS, type Settings } from '../state/settings';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const WALLS = [
  { key: 'mouldB', label: 'Bed wall' },
  { key: 'mouldF', label: 'Dresser wall' },
] as const;

const SLIDER_LABELS = [
  { key: 'mgap', label: 'Column spacing' },
  { key: 'mcen', label: 'Centre width' },
  { key: 'msw', label: 'Side width' },
] as const;

export function MouldingSection({ settings, update }: Props) {
  const bedOn = settings.mouldB === 'on';
  return (
    <section>
      <h2>Wall moulding</h2>
      <div className="grp">
        <h3>Colour</h3>
        <ChipGroup
          label="Moulding colour"
          options={MOULD_COLOURS}
          value={settings.mould}
          onChange={(id) => update({ mould: id as Settings['mould'] })}
        />
      </div>
      <div className="grp">
        <h3>Show on</h3>
        <div className="chips" role="group" aria-label="Show moulding on">
          {WALLS.map(({ key, label }) => {
            const on = settings[key] === 'on';
            return (
              <button key={key} type="button" className="chip" aria-pressed={on} onClick={() => update({ [key]: on ? 'off' : 'on' })}>
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
            {label} <b>{settings[key]} cm</b>
            <input
              type="range"
              {...SLIDERS[key]}
              value={settings[key]}
              disabled={!bedOn}
              onChange={(e) => update({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
