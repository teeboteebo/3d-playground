import { useId } from 'react';
import { MOULD_COLOURS } from '../data/catalog';
import { dadoRange, spacingMax } from '../scene/mouldLayout';
import type { MouldWall, SectionLayout } from '../scene/mouldLayout';
import type { MouldWallDef } from '../scene/mouldWalls';
import { MOULD_SLIDERS } from '../state/mould';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';

export type MouldRoom = 'bedroom' | 'living';

/** the moulding fields the two rooms have between them */
export interface MouldFields {
  mouldColour: 'white' | 'tone';
  mouldSpacing: number;
  mouldDado: number;
  mouldWalls: Record<string, MouldWall>;
  mouldBedWall?: 'on' | 'off';
  mouldDresserWall?: 'on' | 'off';
  mouldSofaWall?: 'on' | 'off';
  mouldTvWall?: 'on' | 'off';
}

interface RoomProps {
  room: MouldRoom;
  walls: MouldWallDef<string>[];
  b: MouldFields;
  layouts: SectionLayout[][];
  /** the rail's height, m */
  railHeight: number;
  set: (patch: Partial<MouldFields>) => void;
}

/** what applies to the whole room: colour, the walls that show moulding, the room's spacing and dado height */
export function MouldingRoomControls({ room, walls, b, layouts, railHeight, set }: RoomProps) {
  const headingId = useId();
  const largestS = Math.max(...layouts.flatMap((ls) => ls.map((l) => l.spacing)));
  const maxSpacing = Math.max(MOULD_SLIDERS.spacing.min, Math.floor(Math.min(MOULD_SLIDERS.spacing.max, spacingMax(b.mouldDado / 100, railHeight) * 100)));
  const dado = dadoRange(largestS, railHeight);
  const dadoMin = Math.max(MOULD_SLIDERS.dado.min, Math.ceil(dado.min * 100 - 1e-6));
  const dadoMax = Math.max(dadoMin, Math.min(MOULD_SLIDERS.dado.max, Math.floor(dado.max * 100 + 1e-6)));
  const roomId = `${headingId}-room`;
  return (
    <section>
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
    </section>
  );
}
