import { PAINTS, findById } from '../data/catalog';
import { ROOMS, roomSize } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { DayNightSwitch } from './DayNightSwitch';

interface Props {
  settings: Settings;
  update: Update;
}

/** What the panel shows with no room selected: shared lighting and the rooms to pick from. */
export function AllRoomsPanel({ settings, update }: Props) {
  return (
    <>
      <h1>Apartment</h1>
      <p className="sub">Four rooms from the SketchUp model. Pick a room to change it; lighting is shared by all of them.</p>
      <section>
        <h2>Lighting</h2>
        <DayNightSwitch time={settings.time} onChange={(time) => update({ time })} />
      </section>
      <section>
        <h2>Rooms</h2>
        <ul className="roomlist" aria-label="Rooms">
          {ROOMS.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => update({ room: r.id })}>
                <i style={{ background: findById(PAINTS, settings.walls[r.id]).hex }} aria-hidden="true" />
                <span>{r.name}</span>
                <small>{roomSize(r)}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
