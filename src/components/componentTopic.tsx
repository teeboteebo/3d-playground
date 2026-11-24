import { BEMZ_FABRICS } from '../data/bemzFabrics';
import {
  CATEGORIES,
  initialOptions,
  type ChipChoice,
  type ComponentDef,
  type ComponentState,
  type OptionDef,
  type RoomDef,
  type Variant,
} from '../data/components';
import type { ReactNode } from 'react';
import type { StockState } from '../data/catalog';
import { ChipGroup } from './ChipGroup';
import type { Topic, TopicGroup } from './Menu';
import { ProductList } from './ProductList';
import { SofaFabricSection } from './SofaFabricSection';
import { ToggleRow } from './ToggleRow';

/** the first part of a product name, before its colour or finish */
const short = (name: string) => name.split(',')[0];

/** a chips choice's colour: the room's accent colour for a choice that follows it */
const choiceHex = (c: ChipChoice, accent?: string) => (c.followsAccent ? accent : c.hex);

/** the control that sets an option; `accent` is the room's accent colour, for a choice that follows it */
export function optionControl(def: OptionDef, value: string, onChange: (v: string) => void, accent?: string): ReactNode {
  switch (def.kind) {
    case 'fabric':
      return <SofaFabricSection key={def.id} value={value} onChange={onChange} />;
    case 'chips':
      return (
        <ChipGroup
          key={def.id}
          label={def.label}
          options={def.choices.map((c) => ({ id: c.id, name: c.name, hex: choiceHex(c, accent) }))}
          value={value}
          onChange={onChange}
        />
      );
  }
}

/** an option's value in words, with the colour to show beside it where it has one */
export function optionSummary(def: OptionDef, value: string, accent?: string): { text: string; swatch?: string } {
  switch (def.kind) {
    case 'fabric': {
      const f = BEMZ_FABRICS.find((x) => x.code === value);
      return f ? { text: `Bemz ${f.family}, ${f.colour}`, swatch: f.hex } : { text: 'Original fabric' };
    }
    case 'chips': {
      const c = def.choices.find((x) => x.id === value) ?? def.choices.find((x) => x.id === def.initial);
      return c ? { text: c.summary ?? c.name, swatch: choiceHex(c, accent) } : { text: '' };
    }
  }
}

const atInitial = (def: ComponentDef, state: ComponentState) =>
  state.shown === def.initial.shown &&
  state.variant === def.initial.variant &&
  (def.options ?? []).every((o) => (state.options[o.id] ?? o.initial) === o.initial);

/** the menu page of one component: a show/hide switch, the products to choose from, and a note */
export function componentTopic(
  def: ComponentDef,
  state: ComponentState,
  set: (patch: Partial<ComponentState>) => void,
  thumb?: (v: Variant) => string,
  accent?: string,
): Topic {
  const chosen = def.variants.find((v) => v.id === state.variant);
  const optionTexts = (def.options ?? []).map((o) => optionSummary(o, state.options[o.id] ?? o.initial, accent));
  const optionText = optionTexts.length ? optionTexts.map((t) => t.text).join(' · ') : undefined;
  const swatch = optionTexts.find((t) => t.swatch)?.swatch;
  const summary = !state.shown ? 'Hidden' : optionText ? optionText : chosen ? short(chosen.name) : '';
  const items = def.variants.map((v) => ({
    ...v,
    vendor: v.vendor ?? '',
    price: v.price ?? '',
    sizes: v.sizes ?? '',
    stock: v.stock ?? '',
    st: v.st ?? ('un' as StockState),
    url: v.url ?? '',
  }));
  return {
    id: def.id,
    title: def.name,
    summary,
    swatch: state.shown ? swatch : undefined,
    /* a hidden piece keeps the room its swatch takes, so its list's titles stay in line */
    swatchSpace: !!swatch,
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
            meta={(i) => [i.vendor, i.price, i.sizes].filter(Boolean).join(' · ')}
            thumb={thumb}
          />
        ) : null}
        {(def.options ?? []).map((o, i) => (
          <div key={o.id} className={i > 0 ? 'mt6' : undefined}>
            {optionControl(o, state.options[o.id] ?? o.initial, (v) => set({ options: { [o.id]: v } }), accent)}
          </div>
        ))}
        {def.note ? <p className="note">{def.note}</p> : null}
      </>
    ),
    /* back to how the room starts; left out while the piece already is */
    reset: atInitial(def, state)
      ? undefined
      : () => set({ shown: def.initial.shown, variant: def.initial.variant, options: initialOptions(def) }),
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
