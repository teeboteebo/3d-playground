import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { CATEGORIES, type ComponentDef, type ComponentState, type OptionDef, type RoomDef, type Variant } from '../data/components';
import type { ReactNode } from 'react';
import type { StockState } from '../data/catalog';
import type { Topic, TopicGroup } from './Menu';
import { ProductList } from './ProductList';
import { SofaFabricSection } from './SofaFabricSection';
import { ToggleRow } from './ToggleRow';

/** the first part of a product name, before its colour or finish */
const short = (name: string) => name.split(',')[0];

/** the control that sets an option */
export function optionControl(def: OptionDef, value: string, onChange: (v: string) => void): ReactNode {
  switch (def.kind) {
    case 'fabric':
      return <SofaFabricSection key={def.id} value={value} onChange={onChange} />;
  }
}

/** an option's value in words, with the colour to show beside it where it has one */
export function optionSummary(def: OptionDef, value: string): { text: string; swatch?: string } {
  switch (def.kind) {
    case 'fabric': {
      const f = BEMZ_FABRICS.find((x) => x.code === value);
      return f ? { text: `Bemz ${f.family}, ${f.colour}`, swatch: f.hex } : { text: 'Original fabric' };
    }
  }
}

const atInitial = (def: ComponentDef, state: ComponentState) =>
  state.shown === def.initial.shown &&
  state.variant === def.initial.variant &&
  (def.options ?? []).every((o) => (state.options[o.id] ?? o.initial) === (def.initial.options?.[o.id] ?? o.initial));

/** the menu page of one component: a show/hide switch, the products to choose from, and a note */
export function componentTopic(
  def: ComponentDef,
  state: ComponentState,
  set: (patch: Partial<ComponentState>) => void,
  thumb?: (v: Variant) => string,
): Topic {
  const chosen = def.variants.find((v) => v.id === state.variant);
  const option = def.options?.[0];
  const optionText = option ? optionSummary(option, state.options[option.id] ?? option.initial) : undefined;
  const summary = !state.shown ? 'Hidden' : optionText ? optionText.text : chosen ? short(chosen.name) : '';
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
    swatch: optionText?.swatch,
    content: (
      <>
        <div className="piece-show">
          <ToggleRow
            label="Show in room"
            hint={state.shown ? 'In the room' : 'Hidden from the room'}
            checked={state.shown}
            onChange={(shown) => set({ shown })}
          />
        </div>
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
        {(def.options ?? []).map((o) => (
          <div key={o.id}>
            {optionControl(o, state.options[o.id] ?? o.initial, (v) => set({ options: { ...state.options, [o.id]: v } }))}
          </div>
        ))}
        {def.note ? <p className="note">{def.note}</p> : null}
      </>
    ),
    /* back to how the room starts; left out while the piece already is */
    reset: atInitial(def, state)
      ? undefined
      : () => set({ shown: def.initial.shown, variant: def.initial.variant, options: { ...def.initial.options } }),
  };
}

/** the room's components under their categories, in CATEGORIES order, each with its components in their group */
export function componentGroups(room: RoomDef, topic: (def: ComponentDef) => Topic): TopicGroup[] {
  return CATEGORIES.flatMap(({ id, title }) => {
    const defs = room.components.filter((c) => c.category === id);
    const declared = new Set((room.groups ?? []).map((g) => g.id));
    /* a component whose group is not declared is listed as ungrouped, never dropped */
    const topics = defs.filter((c) => !c.group || !declared.has(c.group)).map(topic);
    const groups = (room.groups ?? [])
      .map((g) => ({ title: g.name, topics: defs.filter((c) => c.group === g.id).map(topic) }))
      .filter((g) => g.topics.length > 0);
    return topics.length || groups.length ? [{ title, topics, groups }] : [];
  });
}
