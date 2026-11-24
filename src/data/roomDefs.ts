import { LIVING } from './living';
import { OFFICE } from './office';

/** every room that is made of components */
export const ROOM_DEFS = { living: LIVING, office: OFFICE } as const;

export type ComponentRoom = keyof typeof ROOM_DEFS;
export type ComponentId<R extends ComponentRoom> = (typeof ROOM_DEFS)[R]['components'][number]['id'];
