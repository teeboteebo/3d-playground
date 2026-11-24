import { BEMZ_FABRICS } from '../data/bemzFabrics';
import type { ComponentDef, ComponentState, OptionDef, RoomDef } from '../data/components';

export type ComponentStates<K extends string> = Record<K, ComponentState>;

export function componentDefaults<K extends string>(room: RoomDef): ComponentStates<K> {
  return Object.fromEntries(
    room.components.map((c) => [c.id, { shown: c.initial.shown, variant: c.initial.variant, options: { ...c.initial.options } }]),
  ) as ComponentStates<K>;
}

/** an option's saved value if its kind accepts it, otherwise the option's initial value */
function sanitizeOption(def: OptionDef, value: unknown): string {
  switch (def.kind) {
    case 'fabric':
      return value === 'original' || BEMZ_FABRICS.some((f) => f.code === value) ? (value as string) : def.initial;
  }
}

function sanitizeOptions(c: ComponentDef, raw: unknown): Record<string, string> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries((c.options ?? []).map((d) => [d.id, sanitizeOption(d, o[d.id])]));
}

/** each component's saved state, any invalid or missing field taken from its definition's initial state */
export function sanitizeComponents<K extends string>(raw: unknown, room: RoomDef): ComponentStates<K> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(
    room.components.map((c) => {
      const s = (o[c.id] && typeof o[c.id] === 'object' ? o[c.id] : {}) as Record<string, unknown>;
      const known = c.variants.some((v) => v.id === s.variant);
      return [
        c.id,
        {
          shown: typeof s.shown === 'boolean' ? s.shown : c.initial.shown,
          variant: known ? (s.variant as string) : c.initial.variant,
          options: sanitizeOptions(c, s.options),
        },
      ];
    }),
  ) as ComponentStates<K>;
}

/** the product to draw, or 'none' for a hidden piece: the bridge for scene code written around 'none' */
export function drawn(state: ComponentState): string {
  return state.shown ? state.variant : 'none';
}
