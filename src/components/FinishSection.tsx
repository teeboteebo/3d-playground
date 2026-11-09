import { FLOORS, PAINTS, type RoomId } from '../data/catalog';
import type { Settings } from '../state/settings';
import { ChipGroup } from './ChipGroup';

interface Props {
  room: RoomId;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

/** Wall paint and floor tone for one room. */
export function FinishSection({ room, settings, update }: Props) {
  return (
    <section>
      <h2>Walls and floor</h2>
      <ChipGroup
        label="Wall colour"
        options={PAINTS}
        value={settings.walls[room]}
        onChange={(id) => update({ walls: { ...settings.walls, [room]: id } })}
      />
      <ChipGroup
        className="mt6"
        label="Floor"
        options={FLOORS}
        value={settings.floors[room]}
        onChange={(id) => update({ floors: { ...settings.floors, [room]: id } })}
      />
    </section>
  );
}
