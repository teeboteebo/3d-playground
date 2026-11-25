import { BEDROOM } from './bedroom';
import type { LampKind, RoomDef } from './components';
import { HALL } from './hall';
import { LIVING } from './living';
import { OFFICE } from './office';
import type { RoomId } from './rooms';

/** every room, described as the components it is made of; a room with no pieces has none */
export const ROOM_DEFS = { bedroom: BEDROOM, hall: HALL, living: LIVING, office: OFFICE } as const;

export type ComponentId<R extends RoomId> = (typeof ROOM_DEFS)[R]['components'][number]['id'];

/** the rooms with a component of catalog lamp kind K, read from their definitions */
export type LampRoom<K extends LampKind = LampKind> = {
  [R in RoomId]: Extract<(typeof ROOM_DEFS)[R]['components'][number], { lamp: K }> extends never ? never : R;
}[RoomId];

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
