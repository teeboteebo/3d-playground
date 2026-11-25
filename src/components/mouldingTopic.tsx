import { BEDX } from '../scene/bedroom/dimensions';
import { mouldProfile, mouldRoom } from '../scene/mouldProfile';
import { wallLayouts, type MouldWallDef } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import type { MenuNav, Topic } from './Menu';
import { resetMoulding } from './roomTopics';
import { equal } from '../lib/equal';
import { DEFAULTS } from '../state/settings';
import { EXAMPLE_LENGTHS, SHOP_DEFAULTS } from '../state/mouldShop';
import { MouldSectionControls } from './MouldSectionControls';
import { MouldShopControls } from './MouldShopControls';
import { ShoppingListPage } from './ShoppingListPage';
import type { ShoppingState } from './useShoppingList';
import { formatKr } from '../lib/format';
import { MouldingRoomControls, type MouldFields, type MouldRoom } from './MouldingSection';

const COLOUR_SHORT: Record<MouldFields['mouldColour'], string> = { white: 'White', tone: 'Wall tone' };

/**
 * The room's wall moulding as a menu page: colour, which walls carry it and the room's spacing and dado on the page
 * itself, and a page of its own for each wall section's columns.
 */
export function mouldingTopic(room: MouldRoom, walls: MouldWallDef<string>[], settings: Settings, update: Update, shopping: ShoppingState, menu: MenuNav): Topic {
  const b: MouldFields = settings.rooms[room].moulding;
  const start: MouldFields = DEFAULTS.rooms[room].moulding;
  const set = (patch: Partial<MouldFields>) => update({ rooms: { [room]: { moulding: patch } } });
  const layouts = walls.map((def) => wallLayouts(def, mouldRoom(b, settings.mouldShop), b.mouldWalls, room === 'bedroom' ? BEDX : undefined));
  const onWalls = walls.filter((w) => b[w.toggle] === 'on').map((w) => w.label);
  return {
    id: 'moulding',
    title: 'Wall moulding',
    summary: onWalls.length ? `${COLOUR_SHORT[b.mouldColour]} · ${onWalls.join(', ')}` : 'Off',
    reset: resetMoulding(settings, update, room, ['mouldColour', 'mouldSpacing', 'mouldDado', 'mouldWalls', ...walls.map((w) => w.toggle as keyof MouldFields)]),
    sub: 'Panel moulding split by a rail at dado height. Each wall section has its own spacing and columns.',
    content: <MouldingRoomControls room={room} walls={walls} b={b} layouts={layouts} railHeight={mouldProfile(settings.mouldShop).railHeight} frameWidth={mouldProfile(settings.mouldShop).frameWidth} set={set} />,
    topicsTitle: 'Walls and shopping list',
    topics: walls.flatMap((def, wi) =>
      def.sections.map((sec, si): Topic => {
        const on = b[def.toggle] === 'on';
        const wall = b.mouldWalls[sec.key];
        const layout = layouts[wi][si];
        const label = def.sections.length === 1 ? def.label : `${def.label}: ${sec.label}`;
        const columns = layout.count === 1 ? '1 column' : `${layout.count} columns`;
        return {
          id: sec.key,
          title: label,
          summary: on ? `${columns} · ${wall.spacing ?? b.mouldSpacing} cm spacing` : 'Hidden',
          reset: equal(wall, start.mouldWalls[sec.key]) ? undefined : () => set({ mouldWalls: { ...b.mouldWalls, [sec.key]: start.mouldWalls[sec.key] } }),
          content: (
            <MouldSectionControls
              def={sec}
              label={label}
              wall={wall}
              layout={layout}
              roomSpacing={b.mouldSpacing}
              on={on}
              onChange={(w) => set({ mouldWalls: { ...b.mouldWalls, [sec.key]: w } })}
            />
          ),
        };
      }),
    ).concat(shoppingTopic(room, settings, update, shopping, menu)),
  };
}

const shoppingSummary = (s: ShoppingState): string =>
  s.status === 'empty' ? 'Nothing to buy'
  : s.status === 'needs-products' ? 'Add store lengths'
  : s.result ? `${formatKr(s.result.total)}${s.result.missing.length ? ' · prices to fill in' : s.status === 'working' ? ' · optimising' : ''}`
  : 'Working it out…';

/** what to buy for the room's moulding, with the products it is bought from on a page of its own */
function shoppingTopic(room: MouldRoom, settings: Settings, update: Update, shopping: ShoppingState, menu: MenuNav): Topic {
  const { panel, railSeparate, rail } = settings.mouldShop;
  const lengths = panel.lengths.length;
  return {
    id: 'shopping',
    title: 'Shopping list',
    summary: shoppingSummary(shopping),
    sub: 'What to buy for this room’s wall moulding, and every cut to make. It follows what you see in the 3D view.',
    content: (
      <ShoppingListPage
        state={shopping}
        shop={settings.mouldShop}
        title={`Wall moulding, ${room === 'bedroom' ? 'bedroom' : 'living room'}`}
        actions={{
          openProducts: () => menu.go(['moulding', 'shopping', 'products']),
          useExamples: () => {
            const shop = settings.mouldShop;
            const fill = (p: typeof shop.panel) => (p.lengths.length ? p : { ...p, lengths: EXAMPLE_LENGTHS });
            update({ mouldShop: { ...shop, panel: fill(shop.panel), rail: shop.railSeparate ? fill(shop.rail) : shop.rail } });
          },
        }}
      />
    ),
    topicsTitle: 'Settings',
    topics: [
      {
        id: 'products',
        title: 'Products and settings',
        summary: `${panel.width} × ${panel.depth} mm · ${lengths === 1 ? '1 length' : `${lengths} lengths`}${railSeparate ? ` · rail ${rail.width} mm` : ''}`,
        sub: 'The moulding your store sells. They are shared by every room, and the 3D view is drawn at their size.',
        content: <MouldShopControls shop={settings.mouldShop} onChange={(mouldShop) => update({ mouldShop })} />,
        reset: equal(settings.mouldShop, SHOP_DEFAULTS) ? undefined : () => update({ mouldShop: SHOP_DEFAULTS }),
      },
    ],
  };
}


