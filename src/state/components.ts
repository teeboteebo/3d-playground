import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { initialOptions, type ComponentDef, type ComponentState, type OptionDef, type RoomDef } from '../data/components';

export type ComponentStates<K extends string> = Record<K, ComponentState>;

export function componentDefaults<K extends string>(room: RoomDef): ComponentStates<K> {
  return Object.fromEntries(
    room.components.map((c) => [c.id, { shown: c.initial.shown, variant: c.initial.variant, options: initialOptions(c) }]),
  ) as ComponentStates<K>;
}

/** an option's saved value if its kind accepts it, otherwise the option's initial value */
function sanitizeOption(def: OptionDef, value: unknown): string {
  switch (def.kind) {
    case 'fabric':
      return value === 'original' || BEMZ_FABRICS.some((f) => f.code === value) ? (value as string) : def.initial;
    case 'chips':
      return def.choices.some((c) => c.id === value) ? (value as string) : def.initial;
  }
}

/** an own field of a saved object: a name such as 'constructor' is never one that was saved */
const own = (o: Record<string, unknown>, key: string): unknown => (Object.hasOwn(o, key) ? o[key] : undefined);

function sanitizeOptions(c: ComponentDef, raw: unknown): Record<string, string> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries((c.options ?? []).map((d) => [d.id, sanitizeOption(d, own(o, d.id))]));
}

/** each component's saved state, any invalid or missing field taken from its definition's initial state */
export function sanitizeComponents<K extends string>(raw: unknown, room: RoomDef): ComponentStates<K> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(
    room.components.map((c) => {
      const saved = own(o, c.id);
      const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
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

/**
 * a room's component states with a patch applied, each component and each option on its own; a component or option the
 * room does not define is ignored
 */
export function patchComponents<K extends string>(
  room: RoomDef,
  states: ComponentStates<K>,
  patch: Partial<Record<string, Partial<ComponentState>>>,
): ComponentStates<K> {
  const next: Record<string, ComponentState> = { ...states };
  for (const c of room.components) {
    const p = own(patch, c.id) as Partial<ComponentState> | undefined;
    if (!p) continue;
    const options = { ...next[c.id].options };
    for (const o of c.options ?? []) {
      const v = own(p.options ?? {}, o.id);
      if (v !== undefined) options[o.id] = v as string;
    }
    next[c.id] = {
      shown: p.shown ?? next[c.id].shown,
      variant: p.variant ?? next[c.id].variant,
      options,
    };
  }
  return next as ComponentStates<K>;
}
