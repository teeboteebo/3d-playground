import type { ReactNode } from 'react';
import { PAINTS, findById } from '../data/catalog';
import type { RoomId } from '../data/rooms';
import { equal } from '../lib/equal';
import { DEFAULTS, type Settings, type SettingsPatch } from '../state/settings';
import type { Update } from '../state/useSettings';
import { FinishSection } from './FinishSection';
import type { Topic } from './Menu';
import { ROWS, type RowId } from './menuStructure';

/** the way from a room's first page back to all rooms */
export interface RoomExit {
  text: string;
  label: string;
  onExit: () => void;
}

type RoomKey = 'bedroom' | 'living' | 'office';

/** a row of a room's first page, titled and placed as menuStructure says */
export function roomRow(id: RowId, topic: Omit<Topic, 'id' | 'title' | 'section'>): Topic {
  return { id, title: ROWS[id].title, section: ROWS[id].section, ...topic };
}

/** puts some of a room's fields back to how the app starts; undefined while they already are */
export function resetFields<R extends RoomKey>(settings: Settings, update: Update, room: R, keys: readonly (keyof Settings[R])[]): (() => void) | undefined {
  const now = settings[room];
  const start = DEFAULTS[room];
  if (keys.every((k) => equal(now[k], start[k]))) return undefined;
  const patch = Object.fromEntries(keys.map((k) => [k, start[k]]));
  return () => update({ [room]: patch } as SettingsPatch);
}

/** a room's wall paint */
export function wallsTopic(room: RoomId, settings: Settings, update: Update): Topic {
  const paint = findById(PAINTS, settings.walls[room]);
  const start = DEFAULTS.walls[room];
  return roomRow('walls', {
    summary: paint.name,
    swatch: paint.hex,
    content: <FinishSection room={room} settings={settings} update={update} />,
    reset: settings.walls[room] === start ? undefined : () => update({ walls: { ...settings.walls, [room]: start } }),
  });
}

/** what the room is, how big, and what the model assumes: the last row of every room */
export function aboutTopic(text: ReactNode): Topic {
  return roomRow('about', { summary: 'Sizes, products and what is assumed', content: <p className="note">{text}</p> });
}
