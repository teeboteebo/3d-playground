import { CEILING, type Room } from '../data/rooms';
import { tangent, type Wall } from './apartment';
import type { Translation } from './rigidPlacement';

export type PlacementSurface = { kind: 'floor' } | { kind: 'wall'; wall: Wall };

/** Intersect the room shell, not the moving furniture. Openings remain wall targets so placement can reject them. */
export function roomSurface(room: Room, walls: readonly Wall[], origin: Translation, ray: Translation): PlacementSurface | null {
  let nearest = Infinity;
  let target: PlacementSurface | null = null;
  if (ray.y < 0) {
    const t = -origin.y / ray.y;
    const x = origin.x + t * ray.x, z = origin.z + t * ray.z;
    if (t >= 0 && room.poly.every(([ax, az], i) => {
      const [bx, bz] = room.poly[(i + 1) % room.poly.length];
      return (bx - ax) * (z - az) >= (bz - az) * (x - ax);
    })) {
      nearest = t;
      target = { kind: 'floor' };
    }
  }
  for (const wall of walls) {
    const [ux, uz] = tangent(wall);
    const rate = -uz * ray.x + ux * ray.z;
    if (rate >= 0) continue;
    const dx = origin.x - wall.a[0], dz = origin.z - wall.a[1];
    const t = (uz * dx - ux * dz) / rate;
    if (t < 0 || t >= nearest) continue;
    const u = ux * (dx + t * ray.x) + uz * (dz + t * ray.z);
    const y = origin.y + t * ray.y;
    if (u >= 0 && u <= wall.length && y >= 0 && y <= CEILING) {
      nearest = t;
      target = { kind: 'wall', wall };
    }
  }
  return target;
}
