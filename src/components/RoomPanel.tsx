import type { ReactNode } from 'react';
import type { Variant } from '../data/components';
import type { RoomId } from '../data/rooms';
import { roomById, roomSize } from '../data/rooms';
import { rugThumbnail, roundRugThumbnail } from '../scene/canvas';
import { BEDROOM_MOULD_WALLS, LIVING_MOULD_WALLS } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Editor } from '../state/useEditor';
import type { Update } from '../state/useSettings';
import { Menu, type MenuNav, type Topic } from './Menu';
import type { MouldRoom } from './MouldingSection';
import { mouldingTopic } from './mouldingTopic';
import { roomPage } from './roomPage';
import type { RoomExit } from './roomTopics';
import { useShoppingList } from './useShoppingList';

interface Props {
  room: RoomId;
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
  editor: Editor;
}

/** what a room's first page says about it: a line under the title, and the About text */
const PAGES: Record<RoomId, { blurb: string; about: (size: string) => ReactNode }> = {
  bedroom: {
    blurb: 'Green walls, built-in Pax wardrobes, white trim, an oak bed and dresser.',
    about: () => (
      <>
        Colours are screen approximations of the hex values, and real paint shifts with your light. Room is 430 × 395 cm with a 330 cm ceiling. The
        bed follows IKEA TONSTAD 160×200 (169 × 209 cm, headboard 116 cm) and the dresser Mio TOVA (80 × 42 × 100 cm); both are simplified shapes,
        and the mirror shows a stylised reflection. Wall moulding runs along the bed wall: a rail at 75 cm with three columns of panels, big above
        and small below; the bedside tables and lamps sit in the side panels. The ceiling pendant follows IKEA GULLSUDARE 70 cm (rice paper) at the
        centre of the room, hung with about 2 m clearance below. The foot-of-bed bench follows ILVA Amigo (90 × 35 × 45 cm, solid oak, woven seat;
        the shelf and seat weave are simplified). Bedside tables follow AC Design Furniture Cholet (50 × 35 × 25 cm, wall-mounted) and the lamps Mio
        Adina (26 × 18 cm, brushed brass with a textile shade). Floor, lamp and the window and door positions are assumed. The front wall is hidden
        so you can look in; use the Dresser wall view to see it. Rug prices and stock were checked on 3 Nov 2026 and change often.
      </>
    ),
  },
  hall: {
    blurb: 'The corridor between the bedroom and the living room.',
    about: (size) => `${size}, with the bedroom’s smoked oak floor. The corridor between the bedroom and the living room.`,
  },
  living: {
    blurb: 'An angled bay window, with the furniture from the SketchUp model in its places.',
    about: () => (
      <>
        The room is 500 × 465 cm with an angled bay window. The pieces are the models from the SketchUp file, in the places they have there.
        Each piece's page gives its product and size.
      </>
    ),
  },
  office: {
    blurb: 'Two angled corners, a north window and a door out, with a reading corner.',
    about: () => (
      <>
        Each piece's page gives its product and size. All are simplified shapes, and the floor and the window and door positions are
        assumed.
      </>
    ),
  },
};

const THUMBS = {
  bedroom: { rug: (v: Variant) => rugThumbnail(v.id) },
  office: { 'round-rug': (v: Variant) => (v.shape ? roundRugThumbnail((v.shape as { pattern: string }).pattern) : '') },
} as const;

/** A room's menu, the same for every room: its first page and the pages it opens, under a way back to all rooms. */
export function RoomPanel({ room, ...rest }: Props) {
  return room === 'bedroom' || room === 'living' ? <MouldedRoomPanel room={room} {...rest} /> : <RoomMenu room={room} {...rest} />;
}

/** a room with wall moulding, whose shopping list the moulding page shows */
function MouldedRoomPanel({ room, settings, update, menu, exit, editor }: Props & { room: MouldRoom }) {
  const shopping = useShoppingList(room, settings);
  const walls = room === 'bedroom' ? BEDROOM_MOULD_WALLS : LIVING_MOULD_WALLS;
  return <RoomMenu room={room} settings={settings} update={update} menu={menu} exit={exit} editor={editor} moulding={mouldingTopic(room, walls, settings, update, shopping, menu)} />;
}

function RoomMenu({ room, settings, update, exit, menu, editor, moulding }: Props & { moulding?: Topic }) {
  const info = roomById(room);
  const size = roomSize(info);
  const page = PAGES[room];
  const root = roomPage({
    room,
    title: info.name,
    sub: `${size} · ${page.blurb}`,
    settings,
    update,
    menu,
    editor,
    moulding,
    about: page.about(size),
    thumbs: (THUMBS as Partial<Record<RoomId, Record<string, (v: Variant) => string>>>)[room],
  });
  return <Menu root={root} exit={exit} nav={menu} />;
}
