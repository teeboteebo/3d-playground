import type { ReactNode } from 'react';
import { ACCENT_PRESETS, PAINTS, findById } from '../data/catalog';
import type { RoomId } from '../data/rooms';
import { equal } from '../lib/equal';
import { DEFAULTS, type Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { AccentPicker } from './AccentPicker';
import { FinishSection } from './FinishSection';
import type { Topic } from './Menu';
import type { MouldFields, MouldRoom } from './MouldingSection';

/** the way from a room's first page back to all rooms */
export interface RoomExit {
  text: string;
  label: string;
  onExit: () => void;
}

/** puts some of a room's moulding fields back to how the app starts; undefined while they already are */
export function resetMoulding(settings: Settings, update: Update, room: MouldRoom, keys: readonly (keyof MouldFields)[]): (() => void) | undefined {
  const now: MouldFields = settings.rooms[room].moulding;
  const start: MouldFields = DEFAULTS.rooms[room].moulding;
  if (keys.every((k) => equal(now[k], start[k]))) return undefined;
  const patch = Object.fromEntries(keys.map((k) => [k, start[k]]));
  return () => update({ rooms: { [room]: { moulding: patch } } });
}

/** a room's wall paint */
export function wallsTopic(room: RoomId, settings: Settings, update: Update): Topic {
  const paint = findById(PAINTS, settings.rooms[room].paint);
  const start = DEFAULTS.rooms[room].paint;
  return {
    id: 'walls',
    title: 'Wall colour',
    summary: paint.name,
    swatch: paint.hex,
    content: <FinishSection room={room} settings={settings} update={update} />,
    reset: paint.id === start ? undefined : () => update({ rooms: { [room]: { paint: start } } }),
  };
}

/** the bedroom's accent colour: what the vase, the accent pillows and the painting follow */
export function accentTopic(accent: string, settings: Settings, update: Update): Topic {
  const preset = ACCENT_PRESETS.find((p) => p.hex === accent.toUpperCase());
  const start = DEFAULTS.rooms.bedroom.accent;
  return {
    id: 'accent',
    title: 'Accent colour',
    summary: preset ? `${preset.name} · ${accent}` : accent,
    swatch: accent,
    reset: equal(settings.rooms.bedroom.accent, start) ? undefined : () => update({ rooms: { bedroom: { accent: start } } }),
    content: <AccentPicker value={accent} onChange={(hex) => update({ rooms: { bedroom: { accent: hex } } })} />,
  };
}

/** what the room is, how big, and what the model assumes: the last row of every room */
export function aboutTopic(text: ReactNode): Topic {
  return { id: 'about', title: 'About the room', summary: 'Sizes, products and what is assumed', content: <p className="note">{text}</p> };
}
