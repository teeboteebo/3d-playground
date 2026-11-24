import type { ReactNode } from 'react';
import type { ComponentState, Variant } from '../data/components';
import { ROOM_DEFS, type ComponentId } from '../data/roomDefs';
import type { RoomId } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { componentGroups, componentTopic } from './componentTopic';
import type { MenuNav, Topic } from './Menu';
import { ShowHideSection } from './ShowHideSection';
import { aboutTopic, accentTopic, wallsTopic } from './roomTopics';

/**
 * The first page of every room: Room (wall colour, the room's accent colour and moulding where it has them, show or hide
 * pieces where it has any), then the component headings, with About the room last.
 */
export function roomPage<R extends RoomId>(args: {
  room: R;
  title: string;
  sub: string;
  settings: Settings;
  update: Update;
  menu: MenuNav;
  /** the room's wall moulding, for a room that has it */
  moulding?: Topic;
  about: ReactNode;
  /** per component, a product thumbnail (the office's round rug) */
  thumbs?: Partial<Record<ComponentId<R>, (v: Variant) => string>>;
}): Topic {
  const { room, title, sub, settings, update, menu, moulding, about, thumbs } = args;
  const def = ROOM_DEFS[room];
  const state = settings.rooms[room];
  const components = state.components as Record<string, ComponentState>;
  const accent = 'accent' in state ? state.accent : undefined;
  const patchRoom = (patch: Record<string, unknown>) => update({ rooms: { [room]: { components: patch } } } as Parameters<Update>[0]);
  const setShown = (ids: string[], shown: boolean) => patchRoom(Object.fromEntries(ids.map((id) => [id, { shown }])));
  const shownCount = def.components.filter((c) => components[c.id].shown).length;
  const changed = def.components.filter((c) => components[c.id].shown !== c.initial.shown);
  const showHide: Topic = {
    id: 'furniture',
    title: 'Show or hide pieces',
    summary: `${shownCount} of ${def.components.length} shown`,
    /* the checklist stands for every piece, so it highlights none; its switches each point at their own */
    noPoint: true,
    content: (
      <ShowHideSection
        groups={componentGroups(def, (c) => ({ id: c.id, title: c.name, summary: '' }))}
        shown={(id) => components[id].shown}
        set={setShown}
        point={(id) => menu.point?.(id ? [id] : null)}
      />
    ),
    /* back to how the room starts: the lamps off, everything else shown */
    reset: changed.length === 0 ? undefined : () => patchRoom(Object.fromEntries(changed.map((c) => [c.id, { shown: c.initial.shown }]))),
  };
  const thumbOf = thumbs as Record<string, ((v: Variant) => string) | undefined> | undefined;
  return {
    id: room,
    title,
    summary: '',
    sub,
    groups: [
      {
        title: 'Room',
        topics: [wallsTopic(room, settings, update), ...(moulding ? [moulding] : []), ...(accent ? [accentTopic(accent, settings, update)] : []), ...(def.components.length ? [showHide] : [])],
      },
      ...componentGroups(def, (c) => componentTopic(c, components[c.id], (patch) => patchRoom({ [c.id]: patch }), thumbOf?.[c.id], accent)),
    ],
    /* after the groups: the last row of every room */
    topics: [aboutTopic(about)],
  };
}
