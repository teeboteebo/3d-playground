import { useId } from 'react';
import { MOULD_COLOURS } from '../data/catalog';
import { BEDX } from '../scene/bedroom/dimensions';
import { dadoRange, spacingMax } from '../scene/mouldLayout';
import type { MouldWall } from '../scene/mouldLayout';
import { wallLayouts, type MouldWallDef } from '../scene/mouldWalls';
import { MOULD_SLIDERS } from '../state/mould';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';
import { MouldSectionControls } from './MouldSectionControls';

interface Props {
  room: 'bedroom' | 'living';
  /** The walls that can carry moulding: their toggles, labels and sections. */
  walls: MouldWallDef<string>[];
  settings: Settings;
  update: Update;
}

/** the moulding fields the two rooms have between them */
interface Fields {
  mouldColour: 'white' | 'tone';
  mouldSpacing: number;
  mouldDado: number;
  mouldWalls: Record<string, MouldWall>;
  mouldBedWall?: 'on' | 'off';
  mouldDresserWall?: 'on' | 'off';
  mouldSofaWall?: 'on' | 'off';
  mouldTvWall?: 'on' | 'off';
}

export function MouldingSection({ room, walls, settings, update }: Props) {
  const headingId = useId();
  const b: Fields = settings[room];
  const set = (patch: Partial<Fields>) => update({ [room]: patch } as Parameters<Update>[0]);
  const roomCm = { spacing: b.mouldSpacing, dado: b.mouldDado };
  const layouts = walls.map((def) => wallLayouts(def, roomCm, b.mouldWalls, room === 'bedroom' ? BEDX : undefined));
  const largestS = Math.max(...layouts.flatMap((ls) => ls.map((l) => l.spacing)));
  const maxSpacing = Math.max(MOULD_SLIDERS.spacing.min, Math.floor(Math.min(MOULD_SLIDERS.spacing.max, spacingMax(b.mouldDado / 100) * 100)));
  const dado = dadoRange(largestS);
  const dadoMin = Math.max(MOULD_SLIDERS.dado.min, Math.ceil(dado.min * 100 - 1e-6));
  const dadoMax = Math.max(dadoMin, Math.min(MOULD_SLIDERS.dado.max, Math.floor(dado.max * 100 + 1e-6)));
  const roomId = `${headingId}-room`;
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
          {walls.map(({ toggle, label }) => {
            const on = b[toggle] === 'on';
            return (
              <button key={toggle} type="button" className="chip" aria-pressed={on} onClick={() => set({ [toggle]: on ? 'off' : 'on' })}>
                <Icon name={on ? 'check' : 'plus'} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grp" data-testid={`${room}-mould-room`} role="group" aria-labelledby={roomId}>
        <h3 id={roomId}>Spacing and height</h3>
        <label className="sl">
          Spacing <b>{b.mouldSpacing} cm</b>
          <input
            type="range" min={MOULD_SLIDERS.spacing.min} max={maxSpacing} step={MOULD_SLIDERS.spacing.step} value={b.mouldSpacing}
            onChange={(e) => set({ mouldSpacing: Number(e.target.value) })}
          />
        </label>
        <label className="sl">
          Dado height <b>{b.mouldDado} cm</b>
          <input
            type="range" min={dadoMin} max={dadoMax} step={MOULD_SLIDERS.dado.step} value={b.mouldDado}
            onChange={(e) => set({ mouldDado: Number(e.target.value) })}
          />
        </label>
      </div>
      {walls.map((def, wi) =>
        def.sections.map((sec, si) => (
          <MouldSectionControls
            key={sec.key}
            def={sec}
            label={def.sections.length === 1 ? def.label : `${def.label}: ${sec.label}`}
            wall={b.mouldWalls[sec.key]}
            layout={layouts[wi][si]}
            roomSpacing={b.mouldSpacing}
            on={b[def.toggle] === 'on'}
            onChange={(w) => set({ mouldWalls: { ...b.mouldWalls, [sec.key]: w } })}
          />
        )),
      )}
    </section>
  );
}
