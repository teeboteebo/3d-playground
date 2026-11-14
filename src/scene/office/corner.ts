import * as THREE from 'three';
import {
  DRESSERS,
  READING_CHAIRS,
  ROUND_RUGS,
  findById,
  type ArmchairShape,
  type DresserShape,
  type RoundRugShape,
} from '../../data/catalog';
import type { Settings } from '../../state/settings';
import { getRoundRugCanvases } from '../canvas';
import { std } from '../materials';
import { canvasTexture } from '../textures';
import { CORNER, LIFT, placeReadingChair } from './dimensions';

export interface Corner {
  apply(s: Settings): void;
  dispose(): void;
}

/** a built piece: its group (origin on the floor, front along local +x) and what frees it */
interface Piece {
  group: THREE.Group;
  dispose(): void;
}

/** a piece's own meshes and materials; nothing is shared with the rest of the scene */
class Parts {
  readonly group = new THREE.Group();
  private readonly mats: THREE.Material[] = [];

  mat(hex: string, rough = 0.85): THREE.MeshStandardMaterial {
    const m = std(hex, rough);
    this.mats.push(m);
    return m;
  }

  own<M extends THREE.Material>(m: M): M {
    this.mats.push(m);
    return m;
  }

  /** a box from (x0, y0, z0) to (x1, y1, z1) */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  piece(): Piece {
    const { group, mats } = this;
    return {
      group,
      dispose() {
        group.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial) m.map?.dispose();
          m.dispose();
        }
      },
    };
  }
}

/** an upholstered armchair facing +x, centred on the origin: legs, base, seat cushion, back, two arms, wings if any */
export function buildArmchair(s: ArmchairShape): Piece {
  const p = new Parts();
  const fabric = p.mat(s.colour, 0.95);
  const wood = p.mat(s.legColour, 0.6);
  const [x0, x1, z0, z1] = [-s.d / 2, s.d / 2, -s.w / 2, s.w / 2];
  const legH = Math.min(0.12, s.seatH * 0.25);
  const leg = 0.04;
  const inset = 0.05;
  for (const x of [x0 + inset, x1 - inset - leg]) {
    for (const z of [z0 + inset, z1 - inset - leg]) p.box(x, LIFT, z, x + leg, legH, z + leg, wood);
  }
  const cushion = 0.12;
  const armW = Math.min(0.2, s.w * 0.14);
  const armTop = Math.min(s.seatH + 0.22, s.h - 0.05);
  const backT = Math.min(0.22, Math.max(0.15, s.d * 0.2));
  /* the base under the cushion, the cushion between the arms and in front of the back */
  p.box(x0, legH, z0 + armW, x1, s.seatH - cushion, z1 - armW, fabric);
  p.box(x0 + backT, s.seatH - cushion, z0 + armW, x1 - 0.02, s.seatH, z1 - armW, fabric);
  for (const [a, b] of [[z0, z0 + armW], [z1 - armW, z1]]) p.box(x0, legH, a, x1, armTop, b, fabric);
  p.box(x0, legH, z0 + armW, x0 + backT, s.h, z1 - armW, fabric);
  if (s.wings) {
    /* wingback sides: the arm's outer edge carried up beside the back, over its rear part */
    const wingD = Math.min(0.4, s.d * 0.45);
    for (const [a, b] of [[z0, z0 + 0.08], [z1 - 0.08, z1]]) p.box(x0, armTop, a, x0 + wingD, s.h - 0.06, b, fabric);
  }
  return p.piece();
}

/** a chest of drawers facing +x, centred on the origin: carcass on legs or a plinth, stacked fronts with handles */
export function buildDresser(s: DresserShape): Piece {
  const p = new Parts();
  const body = p.mat(s.colour, 0.6);
  /* the carcass a shade darker than the fronts, so the gaps between the fronts read */
  const carcass = p.own(body.clone());
  carcass.color.multiplyScalar(0.7);
  const handleMat = p.mat('#3A3530', 0.4);
  const [x0, x1, z0, z1] = [-s.d / 2, s.d / 2, -s.w / 2, s.w / 2];
  const front = 0.018;
  let base: number;
  if (s.legH > 0) {
    const leg = 0.035;
    const inset = 0.03;
    for (const x of [x0 + inset, x1 - inset - leg]) {
      for (const z of [z0 + inset, z1 - inset - leg]) p.box(x, LIFT, z, x + leg, s.legH, z + leg, carcass);
    }
    base = s.legH;
  } else {
    base = 0.06;
    p.box(x0 + 0.03, LIFT, z0 + 0.03, x1 - 0.05, base, z1 - 0.03, carcass);
  }
  const top = 0.02;
  p.box(x0, base, z0, x1 - front, s.h - top, z1, carcass);
  p.box(x0, s.h - top, z0, x1, s.h, z1, body);
  const gap = 0.006;
  const slot = (s.h - top - base) / s.drawers;
  const handleW = Math.min(0.14, s.w * 0.2);
  for (let i = 0; i < s.drawers; i++) {
    const y0 = base + i * slot + gap / 2;
    const y1 = base + (i + 1) * slot - gap / 2;
    p.box(x1 - front, y0, z0 + gap, x1, y1, z1 - gap, body);
    const hy = y1 - Math.min(0.06, slot * 0.3);
    p.box(x1, hy - 0.008, -handleW / 2, x1 + 0.015, hy + 0.008, handleW / 2, handleMat);
  }
  return p.piece();
}

const RUG_T = 0.01;

/**
 * a round rug centred on the origin: a thin disc with the pattern on top and the edge colour on its rim and
 * underside. CylinderGeometry maps its caps' UVs as a circle inscribed in the unit square, so the square pattern
 * canvas lands centred on the disc. It receives shadows and casts none.
 */
export function buildRoundRug(s: RoundRugShape): Piece {
  const p = new Parts();
  const edge = p.mat(s.edge, 0.95);
  const canvas = getRoundRugCanvases()[s.pattern] as HTMLCanvasElement | undefined;
  const top = canvas
    ? p.own(new THREE.MeshStandardMaterial({ map: canvasTexture(canvas), roughness: 0.95 }))
    : p.mat(s.edge, 0.95);
  /* cylinder groups: 0 the rim, 1 the top cap, 2 the bottom cap */
  const m = new THREE.Mesh(new THREE.CylinderGeometry(s.d / 2, s.d / 2, RUG_T, 96), [edge, top, edge]);
  m.position.y = RUG_T / 2 + LIFT;
  m.castShadow = false;
  m.receiveShadow = true;
  p.group.add(m);
  return p.piece();
}

/** the angle about y that turns a piece's local +x to face the direction `facing` (angle from +x towards +z) */
const turn = (facing: number) => -facing;

/**
 * The office's reading corner: the chosen armchair, dresser and round rug. Each piece is rebuilt only when its id
 * changes; the piece it replaces is removed and freed.
 */
export function buildCorner(parent: THREE.Object3D): Corner {
  const placed = new Map<string, { id: string; piece: Piece }>();

  function remove(name: string) {
    const p = placed.get(name);
    if (!p) return;
    parent.remove(p.piece.group);
    p.piece.dispose();
    placed.delete(name);
  }

  /** the piece called `name` for `id`, built if it changed; null (and none in the scene) for no shape */
  function place<S>(name: string, id: string, shape: S | null, build: (s: S) => Piece): THREE.Group | null {
    if (!shape) {
      remove(name);
      return null;
    }
    const p = placed.get(name);
    if (p?.id === id) return p.piece.group;
    remove(name);
    const piece = build(shape);
    piece.group.name = name;
    parent.add(piece.group);
    placed.set(name, { id, piece });
    return piece.group;
  }

  return {
    apply(s) {
      const chairShape = findById(READING_CHAIRS, s.office.readingChair).shape;
      const chair = place('office-reading-chair', s.office.readingChair, chairShape, buildArmchair);
      if (chair && chairShape) {
        const { x, z, facing } = placeReadingChair(chairShape.w, chairShape.d);
        chair.position.set(x, 0, z);
        chair.rotation.y = turn(facing);
      }
      const dresserShape = findById(DRESSERS, s.office.dresser).shape;
      const dresser = place('office-dresser', s.office.dresser, dresserShape, buildDresser);
      if (dresser && dresserShape) {
        const { a, b, gap } = CORNER.dresserWall;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        /* the wall's normal into the room */
        const nx = (b[1] - a[1]) / len;
        const nz = -(b[0] - a[0]) / len;
        const off = gap + dresserShape.d / 2;
        dresser.position.set((a[0] + b[0]) / 2 + nx * off, 0, (a[1] + b[1]) / 2 + nz * off);
        dresser.rotation.y = turn(Math.atan2(nz, nx));
      }
      const rugShape = findById(ROUND_RUGS, s.office.roundRug).shape;
      const rug = place('office-round-rug', s.office.roundRug, rugShape, buildRoundRug);
      if (rug && rugShape) {
        const { x, windowZ, gap } = CORNER.rug;
        rug.position.set(x, 0, windowZ - gap - rugShape.d / 2);
      }
    },
    dispose() {
      for (const name of [...placed.keys()]) remove(name);
    },
  };
}
