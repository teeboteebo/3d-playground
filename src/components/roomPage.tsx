import type { ReactNode } from 'react';
import type { ComponentState, Variant } from '../data/components';
import { ROOM_DEFS, type ComponentId } from '../data/roomDefs';
import type { RoomId } from '../data/rooms';
import type { Settings } from '../state/settings';
import type { Editor } from '../state/useEditor';
import type { Update } from '../state/useSettings';
import { componentGroups, componentTopic } from './componentTopic';
import type { MenuNav, Topic } from './Menu';
import { GroupEditor } from './GroupEditor';
import { ShowHideSection } from './ShowHideSection';
import { aboutTopic, accentTopic, wallsTopic } from './roomTopics';

export function roomPage<R extends RoomId>(args: {
  room: R;
  title: string;
  sub: string;
  settings: Settings;
  update: Update;
  menu: MenuNav;
  editor: Editor;
  /** the room's wall moulding, for a room that has it */
  moulding?: Topic;
  about: ReactNode;
  /** per component, a product thumbnail (the office's round rug) */
  thumbs?: Partial<Record<ComponentId<R>, (v: Variant) => string>>;
}): Topic {
  const { room, title, sub, settings, update, menu, editor, moulding, about, thumbs } = args;
  const def = ROOM_DEFS[room];
  const state = settings.rooms[room];
  const components: Record<string, ComponentState> = state.components;
  const accent = 'accent' in state ? state.accent : undefined;
  const patchRoom = (patch: Record<string, Partial<ComponentState>>) => update({ rooms: { [room]: { components: patch } } });
  const setShown = (ids: string[], shown: boolean) => patchRoom(Object.fromEntries(ids.map((id) => [id, { shown }])));
  const shownCount = def.components.filter((c) => components[c.id].shown).length;
  const changed = def.components.filter((c) => components[c.id].shown !== c.initial.shown);
  const showHide: Topic = {
    id: 'furniture',
    title: 'Show or hide pieces',
    summary: `${shownCount} of ${def.components.length} shown`,
    noPoint: true,
    content: (
      <ShowHideSection
        groups={componentGroups(def, (c) => ({ id: c.id, title: c.name, summary: '' }))}
        shown={(id) => components[id].shown}
        set={setShown}
        point={(id) => menu.point?.(id ? [id] : null)}
      />
    ),
    reset: changed.length === 0 ? undefined : () => patchRoom(Object.fromEntries(changed.map((c) => [c.id, { shown: c.initial.shown }]))),
  };
  const tree = state.tree;
  const thumbOf = thumbs as Record<string, ((v: Variant) => string) | undefined> | undefined;
  const pieces = def.components.map((c) => componentTopic(c, components[c.id], (patch) => patchRoom({ [c.id]: patch }), thumbOf?.[c.id], accent));
  const groupCount = Object.keys(tree.groups).length;
  const groups: Topic = {
    id: 'groups',
    title: 'Group pieces',
    summary: groupCount === 0 ? 'No groups' : `${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`,
    noPoint: true,
    sub: 'Check pieces here or Shift-click them in the room. Enter a group to work on its members.',
    linkedPages: pieces,
    content: (
      <GroupEditor
        roomName={title}
        editor={{ ...editor, tree }}
        pieceName={(id) => def.components.find((c) => c.id === id)?.name ?? id}
        shown={(id) => components[id].shown}
        open={(id) => menu.go(['groups', id])}
      />
    ),
  };
  return {
    id: room,
    title,
    summary: '',
    sub,
    groups: [
      {
        title: 'Room',
        topics: [
          wallsTopic(room, settings, update),
          ...(moulding ? [moulding] : []),
          ...(accent ? [accentTopic(accent, (value) => update({ rooms: { [room]: { accent: value } } }))] : []),
          ...(def.components.length ? [showHide, groups] : []),
        ],
      },
      ...componentGroups(def, (c) => pieces.find((page) => page.id === c.id)!),
    ],
    /* after the groups: the last row of every room */
    topics: [aboutTopic(about)],
  };
}
