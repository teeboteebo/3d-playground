import type { ComponentDef, ComponentState, RoomDef, Variant } from '../data/components';
import type { StockState } from '../data/catalog';
import type { Topic, TopicGroup } from './Menu';
import { ProductList } from './ProductList';

/** the first part of a product name, before its colour or finish */
const short = (name: string) => name.split(',')[0];

/** the menu page of one component: a show/hide switch, the products to choose from, and a note */
export function componentTopic(
  def: ComponentDef,
  state: ComponentState,
  set: (patch: Partial<ComponentState>) => void,
  thumb?: (v: Variant) => string,
): Topic {
  const chosen = def.variants.find((v) => v.id === state.variant);
  const summary = !state.shown ? 'Hidden' : chosen ? short(chosen.name) : '';
  const items = def.variants.map((v) => ({
    ...v,
    vendor: v.vendor ?? '',
    price: v.price ?? '',
    stock: v.stock ?? '',
    st: v.st ?? ('un' as StockState),
    url: v.url ?? '',
  }));
  return {
    id: def.id,
    title: def.name,
    summary,
    content: (
      <>
        <button type="button" role="switch" className="chip" aria-checked={state.shown} onClick={() => set({ shown: !state.shown })}>
          Show in room
        </button>
        {def.variants.length >= 2 ? (
          <ProductList
            label={def.name}
            items={items}
            value={state.variant}
            onChange={(id) => set({ variant: id, shown: true })}
            meta={(i) => `${i.vendor} · ${i.price}`}
            thumb={thumb}
          />
        ) : null}
        {def.note ? <p className="note">{def.note}</p> : null}
      </>
    ),
  };
}

/** the room's Furniture and Lighting groups, with each component in its group */
export function componentGroups(room: RoomDef, topic: (def: ComponentDef) => Topic): TopicGroup[] {
  const categories = [
    { category: 'furniture', title: 'Furniture' },
    { category: 'lighting', title: 'Lighting' },
  ] as const;
  return categories.flatMap(({ category, title }) => {
    const defs = room.components.filter((c) => c.category === category);
    const declared = new Set((room.groups ?? []).map((g) => g.id));
    /* a component whose group is not declared is listed as ungrouped, never dropped */
    const topics = defs.filter((c) => !c.group || !declared.has(c.group)).map(topic);
    const groups = (room.groups ?? [])
      .map((g) => ({ title: g.name, topics: defs.filter((c) => c.group === g.id).map(topic) }))
      .filter((g) => g.topics.length > 0);
    return topics.length || groups.length ? [{ title, topics, groups }] : [];
  });
}
