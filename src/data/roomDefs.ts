import type { LampKind, RoomDef } from './components';
import { LIVING } from './living';
import { OFFICE } from './office';

/** every room that is made of components */
export const ROOM_DEFS = { living: LIVING, office: OFFICE } as const;

export type ComponentRoom = keyof typeof ROOM_DEFS;
export type ComponentId<R extends ComponentRoom> = (typeof ROOM_DEFS)[R]['components'][number]['id'];

/** the rooms with a component of catalog lamp kind K, read from their definitions */
export type LampRoom<K extends LampKind = LampKind> = {
  [R in ComponentRoom]: Extract<(typeof ROOM_DEFS)[R]['components'][number], { lamp: K }> extends never ? never : R;
}[ComponentRoom];

/** a component the catalog's lamp builder draws, and the room it is in */
export interface CatalogLamp {
  room: LampRoom;
  id: string;
  kind: LampKind;
}

/** the catalog lamps of some rooms, from their definitions: the components marked `lamp`, and no other light */
export function catalogLamps(defs: readonly RoomDef[]): CatalogLamp[] {
  return defs.flatMap((def) =>
    def.components.flatMap((c) => (c.lamp ? [{ room: def.id as LampRoom, id: c.id, kind: c.lamp }] : [])),
  );
}

/** every catalog lamp of every room that is made of components */
export const CATALOG_LAMPS: readonly CatalogLamp[] = catalogLamps(Object.values(ROOM_DEFS));
