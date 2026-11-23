import type { ReactNode } from 'react';
import { FLOOR_LAMPS, PAINTS, PENDANTS, findById } from '../data/catalog';
import type { RoomId } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Topic } from './Menu';

/** the way from a room's first page back to all rooms */
export interface RoomExit {
  text: string;
  label: string;
  onExit: () => void;
}

/** a room's wall paint, as a menu topic */
export function wallsTopic(room: RoomId, settings: Settings, content: ReactNode): Topic {
  const paint = findById(PAINTS, settings.walls[room]);
  return { id: 'walls', title: 'Walls', summary: paint.name, swatch: paint.hex, content };
}

/** a room's pendant and floor lamp, as a menu topic */
export function lightingTopic(room: 'living' | 'office', settings: Settings, content: ReactNode): Topic {
  const { pendant, floorLamp } = settings[room];
  const chosen = [pendant !== 'none' && findById(PENDANTS, pendant).name, floorLamp !== 'none' && findById(FLOOR_LAMPS, floorLamp).name];
  const names = chosen.filter((n): n is string => !!n);
  return { id: 'lighting', title: 'Lighting', summary: names.length ? names.join(' · ') : 'No lamps', content };
}
