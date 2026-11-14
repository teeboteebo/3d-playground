import { MOULD_COLOURS } from '../data/catalog';
import { SLIDERS, type Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';

interface Props {
  room: 'bedroom' | 'living';
  /** The walls that can carry moulding: settings keys (mouldBedWall, mouldSofaWall, ...) and their chip labels. */
  walls: readonly { key: string; label: string }[];
  layoutLabel: string;
  settings: Settings;
  update: Update;
}

type Fields = Record<string, string | number>;

const SLIDER_LABELS = [
  { key: 'mouldGap', label: 'Column spacing' },
  { key: 'mouldCentre', label: 'Centre width' },
  { key: 'mouldSide', label: 'Side width' },
] as const;

export function MouldingSection({ room, walls, layoutLabel, settings, update }: Props) {
  const b = settings[room] as unknown as Fields;
  const set = (patch: Fields) => update({ [room]: patch } as Parameters<Update>[0]);
  const layoutOn = room === 'bedroom' ? b[walls[0].key] === 'on' : walls.some(({ key }) => b[key] === 'on');
  return (
    <section>
      <h2>Wall moulding</h2>
      <div className="grp">
        <h3>Colour</h3>
        <ChipGroup
          label="Moulding colour"
          options={MOULD_COLOURS}
          value={b.mouldColour as string}
          onChange={(id) => set({ mouldColour: id })}
        />
      </div>
      <div className="grp">
        <h3>Show on</h3>
        <div className="chips" role="group" aria-label="Show moulding on">
          {walls.map(({ key, label }) => {
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
      <div className={layoutOn ? 'grp' : 'grp off'} data-testid={room === 'bedroom' ? 'bed-wall-layout' : 'living-layout'}>
        <h3>{layoutLabel}</h3>
        {SLIDER_LABELS.map(({ key, label }) => (
          <label className="sl" key={key}>
            {label} <b>{b[key]} cm</b>
            <input
              type="range"
              {...SLIDERS[key]}
              value={b[key] as number}
              disabled={!layoutOn}
              onChange={(e) => set({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
