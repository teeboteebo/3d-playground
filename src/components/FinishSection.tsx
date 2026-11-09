import { PAINTS, type RoomId } from '../data/catalog';
import type { Settings } from '../state/settings';
import { ChipGroup } from './ChipGroup';

interface Props {
  room: RoomId;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

/** Wall paint for one room. Floors are the bedroom's smoked oak everywhere and are not a choice. */
export function FinishSection({ room, settings, update }: Props) {
  return (
    <section>
      <h2>Walls</h2>
      <ChipGroup
        label="Wall colour"
        options={PAINTS}
        value={settings.walls[room]}
        onChange={(id) => update({ walls: { ...settings.walls, [room]: id } })}
      />
    </section>
  );
}
