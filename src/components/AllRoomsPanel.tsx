import { useState } from 'react';
import { PAINTS, findById } from '../data/catalog';
import { ROOMS, roomSize } from '../data/rooms';
import { equal } from '../lib/equal';
import { DEFAULTS, type Settings } from '../state/settings';
import type { Steps, Update } from '../state/useSettings';

interface Props {
  settings: Settings;
  update: Update;
  steps: Steps;
}

/** every room as the app starts; the store's moulding products are the user's own and stay */
const START = { rooms: DEFAULTS.rooms };
const changed = (s: Settings) => !equal({ rooms: s.rooms }, START);

/** What the panel shows with no room selected: the rooms to pick from, and a way to start over. */
export function AllRoomsPanel({ settings, update, steps }: Props) {
  /* set once the rooms have been started over, until something else changes */
  const [startedOver, setStartedOver] = useState(false);
  const dirty = changed(settings);
  return (
    <>
      <h1>Apartment</h1>
      <p className="sub">Four rooms from the SketchUp model. Pick a room to change it. Lighting, at the top of the 3D view, is shared by all of them.</p>
      <section>
        <h2>Rooms</h2>
        <ul className="roomlist" aria-label="Rooms">
          {ROOMS.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => update({ room: r.id })}>
                <i style={{ background: findById(PAINTS, settings.rooms[r.id].paint).hex }} aria-hidden="true" />
                <span>{r.name}</span>
                <small>{roomSize(r)}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Your design</h2>
        <p className="acc-note">Saved in this browser as you go.</p>
        {startedOver && !dirty ? (
          <p className="acc-note mt8" role="status">
            Every room is back to how it started; your store lengths are kept.{' '}
            <button type="button" className="linkish" onClick={steps.undo} disabled={!steps.canUndo}>
              Undo
            </button>
          </p>
        ) : (
          <button
            type="button"
            className="chip mt8"
            disabled={!dirty}
            onClick={() => {
              update(START);
              setStartedOver(true);
            }}
          >
            Start over
          </button>
        )}
      </section>
    </>
  );
}
