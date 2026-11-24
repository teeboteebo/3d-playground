import { FURNITURE } from '../data/catalog';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { roomById, roomSize } from '../data/rooms';
import { LIVING_MOULD_WALLS } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import { Menu, type MenuNav, type Topic } from './Menu';
import { mouldingTopic } from './mouldingTopic';
import { useShoppingList } from './useShoppingList';
import { ShowHideSection } from './ShowHideSection';
import { SofaFabricSection } from './SofaFabricSection';
import { aboutTopic, lampTopics, resetFields, roomRow, wallsTopic, type RoomExit } from './roomTopics';

interface Props {
  settings: Settings;
  update: Update;
  exit: RoomExit;
  menu: MenuNav;
}

export function LivingPanel({ settings, update, exit, menu }: Props) {
  const { hidden, sofaFabric } = settings.living;
  const shopping = useShoppingList('living', settings);
  const fabric = BEMZ_FABRICS.find((f) => f.code === sofaFabric);
  const shown = FURNITURE.length - FURNITURE.filter((f) => hidden.includes(f.id)).length;
  const root: Topic = {
    id: 'living',
    title: 'Living room',
    summary: '',
    sub: `${roomSize(roomById('living'))} · An angled bay window, with the furniture from the SketchUp model in its places.`,
    topics: [
      wallsTopic('living', settings, update),
      { ...mouldingTopic('living', LIVING_MOULD_WALLS, settings, update, shopping, menu), section: 'walls' },
      ...lampTopics('living', settings, update),
      roomRow('sofa', {
        summary: fabric ? `Bemz ${fabric.family}, ${fabric.colour}` : 'Original fabric',
        swatch: fabric?.hex,
        reset: resetFields(settings, update, 'living', ['sofaFabric']),
        content: <SofaFabricSection settings={settings} update={update} />,
      }),
      roomRow('furniture', {
        summary: shown === FURNITURE.length ? 'All shown' : `${shown} of ${FURNITURE.length} shown`,
        reset: resetFields(settings, update, 'living', ['hidden']),
        content: (
          <ShowHideSection
            groups={[{ title: 'Furniture', topics: FURNITURE.map((f) => ({ id: f.id, title: f.name, summary: '' })) }]}
            shown={(id) => !hidden.includes(id)}
            set={(ids, on) => update({ living: { hidden: on ? hidden.filter((h) => !ids.includes(h)) : [...new Set([...hidden, ...ids])] } })}
          />
        ),
      }),
      aboutTopic(
        <>
          The room is 500 × 465 cm with an angled bay window. The sofa, shelving, plant, rug and other pieces are the models from the SketchUp file,
          in the places they have there; the TV sideboard is a 160 × 75 cm piece built in the bedroom dresser’s style. Sofa fabrics are Bemz covers
          for the IKEA NOCKEBY sofa, and plain fabrics are drawn with a woven texture rather than their photo.
        </>,
      ),
    ],
  };
  return <Menu root={root} exit={exit} nav={menu} />;
}
