import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { initialOptions, type ComponentDef, type ComponentState, type OptionDef, type PiecePose, type PieceSupport, type RoomDef } from '../data/components';
import { CEILING, roomById, type Room } from '../data/rooms';

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
const own = <T>(o: Record<string, T>, key: string): T | undefined => (Object.hasOwn(o, key) ? o[key] : undefined);

function sanitizeOptions(c: ComponentDef, raw: unknown): Record<string, string> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries((c.options ?? []).map((d) => [d.id, sanitizeOption(d, own(o, d.id))]));
}

function savedPose(raw: unknown, c: ComponentDef, room: Room): PiecePose | undefined {
  if (!raw || typeof raw !== 'object' || c.mount?.kind === 'fixed') return;
  const { x, y, z, yaw, edge, support: saved } = raw as Record<string, unknown>;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || typeof yaw !== 'number'
    || ![x, y, z, yaw].every(Number.isFinite) || Math.abs(y) > CEILING) return;
  const maxPoseOffset = 2 * Math.max(...room.poly.map(([px, pz]) => Math.hypot(px, pz)));
  if (Math.hypot(x, z) > maxPoseOffset) return;
  const validEdge = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
    && v >= 0 && v < room.poly.length && !room.open?.includes(v);
  let support: PieceSupport | undefined;
  if (saved !== undefined) {
    if (!saved || typeof saved !== 'object' || !('kind' in saved)) return;
    if (saved.kind === 'floor') support = { kind: 'floor' };
    else if ((saved.kind === 'wall' || saved.kind === 'wall-and-floor') && 'edge' in saved && validEdge(saved.edge))
      support = { kind: saved.kind, edge: saved.edge };
    else return;
  } else {
    if (c.mount?.kind !== 'wall' && y !== 0) return;
    if (edge !== undefined) {
      if (!c.mount || !('edge' in c.mount) || !validEdge(edge)) return;
      support = { kind: c.mount.kind, edge };
    }
  }
  return { x, y, z, yaw, ...(support && { support }) };
}

/** each component's saved state, any invalid or missing field taken from its definition's initial state */
export function sanitizeComponents<K extends string>(raw: unknown, room: RoomDef): ComponentStates<K> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(
    room.components.map((c) => {
      const saved = own(o, c.id);
      const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
      const known = c.variants.some((v) => v.id === s.variant);
      const pose = savedPose(s.pose, c, roomById(room.id));
      return [
        c.id,
        {
          shown: typeof s.shown === 'boolean' ? s.shown : c.initial.shown,
          variant: known ? (s.variant as string) : c.initial.variant,
          options: sanitizeOptions(c, s.options),
          ...(pose && { pose }),
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
    const p = own(patch, c.id);
    if (!p) continue;
    const options = { ...next[c.id].options };
    for (const o of c.options ?? []) {
      const v = own(p.options ?? {}, o.id);
      if (v !== undefined) options[o.id] = v;
    }
    next[c.id] = {
      ...next[c.id],
      shown: p.shown ?? next[c.id].shown,
      variant: p.variant ?? next[c.id].variant,
      options,
      ...(p.pose && { pose: p.pose }),
    };
  }
  return next as ComponentStates<K>;
}
