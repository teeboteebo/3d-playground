import type { XZ } from '../data/rooms';

/** Two convex footprints share area only if they overlap along every edge normal of both polygons. */
export function footprintsOverlap(a: readonly XZ[], b: readonly XZ[], tolerance = 0): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x, z] = poly[i];
      const [nextX, nextZ] = poly[(i + 1) % poly.length];
      const nx = nextZ - z;
      const nz = x - nextX;
      if (nx === 0 && nz === 0) continue;
      const slack = tolerance * Math.hypot(nx, nz);
      const project = ([px, pz]: XZ) => px * nx + pz * nz;
      const pa = a.map(project);
      const pb = b.map(project);
      if (Math.max(...pa) <= Math.min(...pb) + slack || Math.max(...pb) <= Math.min(...pa) + slack) return false;
    }
  }
  return true;
}
