import { OFFICE } from './office';

/** every room that is made of components; the living room joins in a later step */
export const ROOM_DEFS = { office: OFFICE } as const;

export type ComponentRoom = keyof typeof ROOM_DEFS;
export type ComponentId<R extends ComponentRoom> = (typeof ROOM_DEFS)[R]['components'][number]['id'];
