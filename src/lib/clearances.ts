import { CEILING, type Room, type XZ } from '../data/rooms';
import type { PlacedLeaf, Translation } from '../scene/rigidPlacement';

/** One dashed distance guide in scene metres; `cm` is its length rounded to a tenth of a centimetre. */
export interface Clearance {
  label: string;
  from: Translation;
  to: Translation;
  cm: number;
}

/** A clearance that remembers which of the measured leaves it belongs to. */
export interface LeafClearance extends Clearance {
  leaf: number;
}

const EPS = 1e-6;
/** Gaps below half a millimetre are contact, not a distance worth drawing. */
const MIN_M = 0.0005;
const AXES: readonly { dir: XZ; label: string }[] = [
  { dir: [-1, 0], label: '−X to wall' },
  { dir: [1, 0], label: '+X to wall' },
  { dir: [0, -1], label: '−Z to wall' },
  { dir: [0, 1], label: '+Z to wall' },
];

const cm = (m: number) => Math.round(m * 1000) / 10;

/** The point of the footprint furthest along `dir`; the middle of the supporting edge when one faces `dir` squarely. */
function support(fp: readonly XZ[], dir: XZ): XZ {
  const proj = (p: XZ) => p[0] * dir[0] + p[1] * dir[1];
  const max = Math.max(...fp.map(proj));
  const top = fp.filter((p) => proj(p) > max - EPS);
  return [top.reduce((s, p) => s + p[0], 0) / top.length, top.reduce((s, p) => s + p[1], 0) / top.length];
}

/** Distance along the ray from `p` to the room outline; a ray leaving the room at `p` is contact (0). */
function toBoundary(poly: readonly XZ[], p: XZ, d: XZ): number | undefined {
  const area = poly.reduce((s, [x, z], i) => {
    const [nx, nz] = poly[(i + 1) % poly.length];
    return s + x * nz - nx * z;
  }, 0);
  let best: number | undefined;
  poly.forEach(([ax, az], i) => {
    const [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax;
    const ez = bz - az;
    const denom = d[0] * ez - d[1] * ex;
    if (Math.abs(denom) < 1e-12) return;
    const t = ((ax - p[0]) * ez - (az - p[1]) * ex) / denom;
    const s = ((ax - p[0]) * d[1] - (az - p[1]) * d[0]) / denom;
    if (s < -EPS || s > 1 + EPS || t < -EPS) return;
    // outward normal of this edge, whichever way the outline winds
    const out = (area > 0 ? [ez, -ex] : [-ez, ex]) as XZ;
    if (t < EPS && d[0] * out[0] + d[1] * out[1] <= 0) return;
    best = best === undefined ? Math.max(t, 0) : Math.min(best, Math.max(t, 0));
  });
  return best;
}

/** Length of the segment p → p + d·t that lies inside the convex footprint. */
function insideLength(fp: readonly XZ[], p: XZ, d: XZ, t: number): number {
  const area = fp.reduce((s, [x, z], i) => s + x * fp[(i + 1) % fp.length][1] - fp[(i + 1) % fp.length][0] * z, 0);
  let lo = 0;
  let hi = t;
  for (let i = 0; i < fp.length; i++) {
    const [ax, az] = fp[i];
    const [bx, bz] = fp[(i + 1) % fp.length];
    const ex = bx - ax;
    const ez = bz - az;
    // signed distance to the edge, positive inside
    const side = (area > 0 ? 1 : -1) * (ex * (p[1] - az) - ez * (p[0] - ax));
    const rate = (area > 0 ? 1 : -1) * (ex * d[1] - ez * d[0]);
    if (Math.abs(rate) < 1e-12) {
      if (side < -EPS) return 0;
      continue;
    }
    const at = -side / rate;
    if (rate > 0) lo = Math.max(lo, at);
    else hi = Math.min(hi, at);
  }
  return Math.max(0, hi - lo);
}

const vertical = (a: PlacedLeaf, b: PlacedLeaf) => a.top > b.bottom + EPS && b.top > a.bottom + EPS;

function guide(label: string, p: XZ, d: XZ, t: number, y: number): Clearance {
  const to: Translation = { x: p[0] + d[0] * t, y, z: p[1] + d[1] * t };
  return { label, from: { x: p[0], y, z: p[1] }, to, cm: cm(t) };
}

/**
 * Gaps for the `subjects` among `leaves`, measured from each piece's own outline to the room outline.
 * A floor piece looks along ±X and ±Z; a wall-mounted piece looks along its wall, and up and down when it is hung clear of
 * the floor. A look that runs into another solid *subject* is dropped, so no guide crosses a selection's own empty middle;
 * unrelated leaves never hide a distance to the room. If every look is dropped, the nearest one stays.
 */
export function leafClearances(room: Room, leaves: readonly PlacedLeaf[], subjects: ReadonlySet<number>): LeafClearance[] {
  const out: LeafClearance[] = [];
  leaves.forEach((leaf, index) => {
    if (!subjects.has(index) || leaf.footprint.length < 3) return;
    const { mount } = leaf;
    const mid = (leaf.bottom + leaf.top) / 2;
    const y = mount.kind === 'floor' ? leaf.bottom + 0.01 : mid;
    let looks: { dir: XZ; label: string }[] = [...AXES];
    if ('edge' in mount) {
      const a = room.poly[mount.edge];
      const b = room.poly[(mount.edge + 1) % room.poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const u: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      looks = [
        { dir: [-u[0], -u[1]], label: 'Along wall −' },
        { dir: u, label: 'Along wall +' },
      ];
    }
    const open: LeafClearance[] = [];
    const covered: LeafClearance[] = [];
    for (const { dir, label } of looks) {
      const p = support(leaf.footprint, dir);
      const t = toBoundary(room.poly, p, dir);
      if (t === undefined || t < MIN_M) continue;
      const found = { ...guide(label, p, dir, t, y), leaf: index };
      const blocked = leaves.some((o, j) => j !== index && subjects.has(j) && o.obstructs && vertical(leaf, o)
        && insideLength(o.footprint, p, dir, t) > EPS);
      (blocked ? covered : open).push(found);
    }
    // never leave a piece without a horizontal reference to the room
    if (open.length === 0 && covered.length > 0) open.push(covered.reduce((a, b) => (b.cm < a.cm ? b : a)));
    out.push(...open);
    if (mount.kind === 'wall') {
      const c: XZ = [
        leaf.footprint.reduce((s, p) => s + p[0], 0) / leaf.footprint.length,
        leaf.footprint.reduce((s, p) => s + p[1], 0) / leaf.footprint.length,
      ];
      const down = leaf.bottom;
      const up = CEILING - leaf.top;
      if (down >= MIN_M) out.push({ label: 'Down to floor', from: { x: c[0], y: leaf.bottom, z: c[1] }, to: { x: c[0], y: 0, z: c[1] }, cm: cm(down), leaf: index });
      if (up >= MIN_M) out.push({ label: 'Up to ceiling', from: { x: c[0], y: leaf.top, z: c[1] }, to: { x: c[0], y: CEILING, z: c[1] }, cm: cm(up), leaf: index });
    }
  });
  return out;
}

/** Every leaf's gaps to the room boundary; see `leafClearances`. */
export function clearances(room: Room, leaves: readonly PlacedLeaf[]): readonly Clearance[] {
  return leafClearances(room, leaves, new Set(leaves.keys())).map((c) => ({ label: c.label, from: c.from, to: c.to, cm: c.cm }));
}

/** Footprint size in cm as the smallest rectangle aligned with one of its edges: [long side, short side]. */
export function footprintCm(fp: readonly XZ[]): [number, number] {
  let best: [number, number] | undefined;
  let bestArea = Infinity;
  fp.forEach(([ax, az], i) => {
    const [bx, bz] = fp[(i + 1) % fp.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < EPS) return;
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const along = fp.map(([x, z]) => (x - ax) * ux + (z - az) * uz);
    const across = fp.map(([x, z]) => -(x - ax) * uz + (z - az) * ux);
    const w = Math.max(...along) - Math.min(...along);
    const h = Math.max(...across) - Math.min(...across);
    if (w * h < bestArea) {
      bestArea = w * h;
      best = [Math.max(w, h), Math.min(w, h)];
    }
  });
  return best ? [cm(best[0]), cm(best[1])] : [0, 0];
}
