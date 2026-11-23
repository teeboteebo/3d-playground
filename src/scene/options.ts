import type * as THREE from 'three';
import type { RoomId } from '../data/rooms';

/**
 * Which room-menu page an object in the scene belongs to: its room, and the path of topic ids from that room's
 * summary (['walls'], ['moulding', 'bed']). Clicking the object opens that page; hovering it highlights every object
 * with the same option.
 */
export interface SceneOption {
  room: RoomId;
  path: readonly string[];
}

/** marks `objects` (and so everything inside them) as opening `path` in `room`'s menu */
export function tagOption(objects: Iterable<THREE.Object3D>, room: RoomId, path: readonly string[]): void {
  const option: SceneOption = { room, path };
  for (const o of objects) o.userData.option = option;
}

/** the option of an object or of the nearest of its parents that has one */
export function optionOf(o: THREE.Object3D | null): SceneOption | null {
  for (; o; o = o.parent) {
    const option = o.userData.option as SceneOption | undefined;
    if (option) return option;
  }
  return null;
}

export const sameOption = (a: SceneOption | null, b: SceneOption | null): boolean =>
  a === b || (!!a && !!b && a.room === b.room && a.path.join('/') === b.path.join('/'));
