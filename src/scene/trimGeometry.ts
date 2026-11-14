import * as THREE from 'three';

interface Corner {
  position: THREE.Vector3;
  normal?: THREE.Vector3;
  uv?: THREE.Vector2;
  /** world-space y */
  y: number;
}

const lerpCorner = (a: Corner, b: Corner, t: number): Corner => ({
  position: a.position.clone().lerp(b.position, t),
  normal: a.normal && b.normal ? a.normal.clone().lerp(b.normal, t).normalize() : undefined,
  uv: a.uv && b.uv ? a.uv.clone().lerp(b.uv, t) : undefined,
  y: a.y + (b.y - a.y) * t,
});

/** Sutherland–Hodgman against the plane world y = `cut`, keeping the side below it: 0, 3 or 4 corners */
function clipBelow(corners: Corner[], cut: number): Corner[] {
  const out: Corner[] = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length];
    const aIn = a.y <= cut;
    if (aIn) out.push(a);
    if (aIn !== b.y <= cut) out.push(lerpCorner(a, b, (cut - a.y) / (b.y - a.y)));
  });
  return out;
}

/**
 * Keeps what lies below `y` (world space) inside `inRegion`, clipping triangles that cross it; leaves everything
 * else as it is. Returns a new non-indexed geometry with position, normal and uv (when present) as float attributes.
 *
 * A triangle counts as in the region when any of its world-space corners passes `inRegion`, so a part that reaches
 * in from outside (the String shelf board that ends inside the ladder it shares with the full-height column) goes
 * with the cut instead of being left floating.
 */
export function trimAbove(
  geometry: THREE.BufferGeometry,
  matrixWorld: THREE.Matrix4,
  y: number,
  inRegion: (world: THREE.Vector3) => boolean,
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  const normal = geometry.getAttribute('normal') as Attribute;
  const uv = geometry.getAttribute('uv') as Attribute;
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const world = new THREE.Vector3();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const emit = (c: Corner) => {
    positions.push(c.position.x, c.position.y, c.position.z);
    if (normal) normals.push(c.normal!.x, c.normal!.y, c.normal!.z);
    if (uv) uvs.push(c.uv!.x, c.uv!.y);
  };

  for (let i = 0; i + 2 < count; i += 3) {
    let inside = false;
    const corners = [0, 1, 2].map((k): Corner => {
      const v = index ? index.getX(i + k) : i + k;
      const local = new THREE.Vector3().fromBufferAttribute(position, v);
      world.copy(local).applyMatrix4(matrixWorld);
      if (inRegion(world)) inside = true;
      return {
        position: local,
        normal: normal && new THREE.Vector3().fromBufferAttribute(normal, v),
        // getX/getY decode normalised attributes, like fromBufferAttribute (whose Vector2 typing rejects interleaved)
        uv: uv && new THREE.Vector2(uv.getX(v), uv.getY(v)),
        y: world.y,
      };
    });
    const polygon = inside ? clipBelow(corners, y) : corners;
    // fan: 3 corners give one triangle, 4 give two
    for (let k = 1; k + 1 < polygon.length; k++) [polygon[0], polygon[k], polygon[k + 1]].forEach(emit);
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normal) out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return out;
}
