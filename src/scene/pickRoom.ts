import * as THREE from 'three';
import type { RoomId, XZ } from '../data/rooms';

/** furthest a pointer may travel during a press and still count as a click, in px */
const CLICK_SLOP = 5;
/** how far outside a room's outline a hit still belongs to it: half a 20 cm wall, plus glass and trim */
const WALL_SLOP = 0.12;

/**
 * A press is a click (not an orbit drag or a pinch) when it used one pointer and the pointer never got further
 * than a few pixels from where it went down. `travel` is that furthest distance, so a drag that comes back to
 * its start is still a drag.
 */
export function isClick(travel: number, maxPointers: number): boolean {
  return maxPointers === 1 && travel < CLICK_SLOP;
}

/** the room whose outline contains (x, z), allowing for wall thickness; null outside every room */
export function roomAt(x: number, z: number, rooms: readonly { id: RoomId; poly: readonly XZ[] }[]): RoomId | null {
  let best: RoomId | null = null;
  let bestD = WALL_SLOP;
  for (const r of rooms) {
    const d = distanceOutside(x, z, r.poly);
    if (d === 0) return r.id;
    if (d <= bestD) {
      best = r.id;
      bestD = d;
    }
  }
  return best;
}

const ray = new THREE.Raycaster();

/**
 * The room under a point in normalised device coordinates: the first visible thing the pointer hits (floor,
 * wall, furniture, window) decides, by which room it stands in. Null when the pointer hits nothing in a room.
 */
export function pickRoom(
  ndc: { x: number; y: number },
  camera: THREE.Camera,
  targets: THREE.Object3D[],
  rooms: readonly { id: RoomId; poly: readonly XZ[] }[],
): RoomId | null {
  camera.updateMatrixWorld();
  ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const hit = ray.intersectObjects(targets, true).find((h) => shown(h.object));
  return hit ? roomAt(hit.point.x, hit.point.z, rooms) : null;
}

/** visible all the way up its parents */
function shown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/** 0 inside the polygon, otherwise the distance to its nearest edge */
function distanceOutside(x: number, z: number, poly: readonly XZ[]): number {
  let inside = false;
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const [bx, bz] = poly[i];
    if (bz > z !== az > z && x < ((ax - bx) * (z - bz)) / (az - bz) + bx) inside = !inside;
    const ex = ax - bx;
    const ez = az - bz;
    const t = Math.max(0, Math.min(1, ((x - bx) * ex + (z - bz) * ez) / (ex * ex + ez * ez)));
    d = Math.min(d, Math.hypot(x - (bx + t * ex), z - (bz + t * ez)));
  }
  return inside ? 0 : d;
}
