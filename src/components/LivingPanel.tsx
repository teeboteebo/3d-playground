import { roomById, roomSize } from '../data/rooms';
import { LIVING_MOULD_WALLS } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { Menu, type MenuNav } from './Menu';
import { mouldingTopic } from './mouldingTopic';
import { roomPage } from './roomPage';
import type { RoomExit } from './roomTopics';
import { useShoppingList } from './useShoppingList';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

export function LivingPanel({ settings, update, exit, menu }: Props) {
  const shopping = useShoppingList('living', settings);
  const root = roomPage({
    room: 'living',
    title: 'Living room',
    sub: `${roomSize(roomById('living'))} · An angled bay window, with the furniture from the SketchUp model in its places.`,
    settings,
    update,
    menu,
    roomRows: [mouldingTopic('living', LIVING_MOULD_WALLS, settings, update, shopping, menu)],
    about: (
      <>
        The room is 500 × 465 cm with an angled bay window. The pieces are the models from the SketchUp file, in the places they have there.
        Each piece's page gives its product and size.
      </>
    ),
  });
  return <Menu root={root} exit={exit} nav={menu} />;
}
