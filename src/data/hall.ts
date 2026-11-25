import type { RoomDef } from './components';

/** The hall has no pieces of its own yet: it is a room with a paint and nothing to show or hide. */
export const HALL = { id: 'hall', components: [] } as const satisfies RoomDef;
