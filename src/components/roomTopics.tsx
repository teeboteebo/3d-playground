import type { ReactNode } from 'react';
import { DRESSERS, FLOOR_LAMPS, PAINTS, PENDANTS, READING_CHAIRS, ROUND_RUGS, findById } from '../data/catalog';
import type { RoomId } from '../data/rooms';
import { equal } from '../lib/equal';
import { DEFAULTS, type Settings, type SettingsPatch } from '../state/settings';
import type { Update } from '../state/useSettings';
import { CornerPieceSection } from './CornerPieceSection';
import { FinishSection } from './FinishSection';
import { LampSection } from './LampSection';
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

/** a room's pendant and floor lamp, as a menu topic */
export function lightingTopic(room: 'living', settings: Settings, content: ReactNode): Topic {
  const { pendant, floorLamp } = settings[room];
  const chosen = [pendant !== 'none' && findById(PENDANTS, pendant).name, floorLamp !== 'none' && findById(FLOOR_LAMPS, floorLamp).name];
  const names = chosen.filter((n): n is string => !!n);
  return { id: 'lighting', title: 'Lighting', summary: names.length ? names.join(' · ') : 'No lamps', content };
}
