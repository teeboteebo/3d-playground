import { useId } from 'react';
import { MOULD_COLOURS } from '../data/catalog';
import { SLIDERS, type OnOff, type Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';

type SliderKey = keyof typeof SLIDERS;
type WallKey = 'mouldBedWall' | 'mouldDresserWall' | 'mouldSofaWall' | 'mouldTvWall';

/** the moulding fields the two rooms have between them */
type Fields = Partial<Record<WallKey, OnOff> & Record<SliderKey, number> & { mouldColour: 'white' | 'tone' }>;

/** A group of layout sliders that is greyed out while its wall has no moulding. */
export interface LayoutGroup {
  label: string;
  testId: string;
  /** the wall whose moulding these sliders lay out */
  wall: WallKey;
  sliders: readonly SliderKey[];
}

interface Props {
  room: 'bedroom' | 'living';
  /** The walls that can carry moulding: their settings keys and chip labels. */
  walls: readonly { key: WallKey; label: string }[];
  layouts: readonly LayoutGroup[];
  settings: Settings;
  update: Update;
}

const SLIDER_LABELS: Record<SliderKey, string> = {
  mouldGap: 'Column spacing',
  mouldCentre: 'Centre width',
  mouldSide: 'Side width',
  mouldSofaColumns: 'Columns',
  mouldSofaGap: 'Column gap',
};

/** the column count is a plain number, the rest are lengths */
const unit = (key: SliderKey) => (key === 'mouldSofaColumns' ? '' : ' cm');

export function MouldingSection({ room, walls, layouts, settings, update }: Props) {
  const headingId = useId();
  const b: Fields = settings[room];
  const set = (patch: Fields) => update({ [room]: patch } as Parameters<Update>[0]);
  return (
    <section>
      <h2>Wall moulding</h2>
      <div className="grp">
        <h3>Colour</h3>
        <ChipGroup
          label="Moulding colour"
          options={MOULD_COLOURS}
          value={b.mouldColour as string}
          onChange={(id) => set({ mouldColour: id as 'white' | 'tone' })}
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
      {layouts.map(({ label, testId, wall, sliders }) => {
        const on = b[wall] === 'on';
        const id = `${headingId}-${testId}`;
        return (
          <div className={on ? 'grp' : 'grp off'} data-testid={testId} key={testId} role="group" aria-labelledby={id}>
            <h3 id={id}>{label}</h3>
            {sliders.map((key) => (
              <label className="sl" key={key}>
                {SLIDER_LABELS[key]} <b>{b[key]}{unit(key)}</b>
                <input
                  type="range"
                  {...SLIDERS[key]}
                  value={b[key]}
                  disabled={!on}
                  onChange={(e) => set({ [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        );
      })}
    </section>
  );
}
