import * as THREE from 'three';
import type { LampShape } from '../data/catalog';
import { lin } from './materials';

export interface BuiltLamp {
  /** pendant: origin at the ceiling point; floor lamp: origin on the floor */
  group: THREE.Group;
  /** where the light sits, in the group's coordinates */
  bulb: THREE.Vector3;
  /** shade glow on (evening) or off */
  setGlow(on: boolean): void;
  /** frees the lamp's geometries and materials */
  dispose(): void;
}

const GLOW = new THREE.Color('#FFD9A0');
const METAL = '#2A2A2C';

/** a lamp's own materials and meshes; nothing here is shared with the rest of the scene */
class Parts {
  readonly group = new THREE.Group();
  readonly shades: THREE.MeshStandardMaterial[] = [];
  private readonly mats: THREE.Material[] = [];

  /** dark metal for cords, stems and bases */
  metal(): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color: lin(METAL), roughness: 0.5, metalness: 0.6, emissiveIntensity: 0 });
    this.mats.push(m);
    return m;
  }

  shade(colour: string, double: boolean): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      color: lin(colour),
      roughness: 0.85,
      emissive: GLOW,
      emissiveIntensity: 0,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
    });
    this.mats.push(m);
    this.shades.push(m);
    return m;
  }

  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, isShade = false): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !isShade;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  /** a vertical cylinder between two heights */
  rod(r: number, y0: number, y1: number, mat: THREE.Material, x = 0): THREE.Mesh {
    return this.mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 12), mat, x, (y0 + y1) / 2, 0);
  }

  build(bulb: THREE.Vector3): BuiltLamp {
    const { group, shades } = this;
    return {
      group,
      bulb,
      setGlow(on) {
        for (const m of shades) m.emissiveIntensity = on ? (m.userData.glow as number) : 0;
      },
      dispose: () => {
        group.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        for (const m of this.mats) m.dispose();
      },
    };
  }
}

/** textile and paper shades glow strongly, metal ones only a little */
function shadeMat(p: Parts, colour: string, double: boolean, glow: number): THREE.MeshStandardMaterial {
  const m = p.shade(colour, double);
  m.userData.glow = glow;
  return m;
}

/** a cord from the ceiling down to `y` */
function cord(p: Parts, yBottom: number): void {
  p.rod(0.004, yBottom, 0, p.metal());
}

function globe(s: Extract<LampShape, { type: 'globe' }>, drop: number): BuiltLamp {
  const p = new Parts();
  const cy = -drop + s.d / 2;
  cord(p, cy);
  p.mesh(new THREE.SphereGeometry(s.d / 2, 24, 16), shadeMat(p, s.colour, false, 0.9), 0, cy, 0, true);
  return p.build(new THREE.Vector3(0, cy, 0));
}

function drum(s: Extract<LampShape, { type: 'drum' }>, drop: number): BuiltLamp {
  const p = new Parts();
  const cy = -drop + s.h / 2;
  cord(p, -drop + s.h);
  p.mesh(new THREE.CylinderGeometry(s.d / 2, s.d / 2, s.h, 28, 1, true), shadeMat(p, s.colour, true, 0.9), 0, cy, 0, true);
  return p.build(new THREE.Vector3(0, cy, 0));
}

/** an open hemisphere squashed to height h, opening downwards */
function domeGeo(d: number, h: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(d / 2, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, h / (d / 2), 1);
  return g;
}

function dome(s: Extract<LampShape, { type: 'dome' }>, drop: number): BuiltLamp {
  const p = new Parts();
  cord(p, -drop + s.h);
  p.mesh(domeGeo(s.d, s.h), shadeMat(p, s.colour, true, 0.25), 0, -drop, 0, true);
  return p.build(new THREE.Vector3(0, -drop + s.h * 0.4, 0));
}

function arc(s: Extract<LampShape, { type: 'arc' }>): BuiltLamp {
  const p = new Parts();
  const metal = p.metal();
  const r = s.shadeD / 2;
  const armY = s.h - 0.03;
  p.mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.04, 24), metal, 0, 0.02, 0);
  p.rod(0.015, 0.04, armY, metal);
  const arm = p.mesh(new THREE.CylinderGeometry(0.012, 0.012, s.reach, 8), metal, s.reach / 2, armY, 0);
  arm.rotation.z = Math.PI / 2;
  const shadeH = r;
  p.mesh(domeGeo(s.shadeD, shadeH), shadeMat(p, s.colour, true, 0.25), s.reach, s.h - shadeH, 0, true);
  return p.build(new THREE.Vector3(s.reach, s.h - shadeH * 0.5, 0));
}

function tripod(s: Extract<LampShape, { type: 'tripod' }>): BuiltLamp {
  const p = new Parts();
  const metal = p.metal();
  const top = s.h - s.shadeH;
  const spread = Math.min(0.22, s.shadeD / 2);
  const len = Math.hypot(top, spread);
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, len, 8);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(legGeo, metal);
    leg.position.set((Math.cos(a) * spread) / 2, top / 2, (Math.sin(a) * spread) / 2);
    leg.rotation.set(Math.sin(a) * Math.atan2(spread, top), 0, -Math.cos(a) * Math.atan2(spread, top));
    leg.castShadow = true;
    leg.receiveShadow = true;
    p.group.add(leg);
  }
  p.mesh(new THREE.CylinderGeometry(s.shadeD / 2, s.shadeD / 2, s.shadeH, 28, 1, true), shadeMat(p, s.colour, true, 0.9), 0, s.h - s.shadeH / 2, 0, true);
  const built = p.build(new THREE.Vector3(0, s.h - s.shadeH / 2, 0));
  const dispose = built.dispose;
  built.dispose = () => {
    legGeo.dispose();
    dispose();
  };
  return built;
}

function uplight(s: Extract<LampShape, { type: 'uplight' }>): BuiltLamp {
  const p = new Parts();
  const metal = p.metal();
  const r = s.bowlD / 2;
  const bowlBottom = s.h - r;
  p.mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 24), metal, 0, 0.015, 0);
  p.rod(0.014, 0.03, bowlBottom + 0.02, metal);
  /* the lower half of a sphere, open at the top, seen from inside as well */
  const bowl = new THREE.SphereGeometry(r, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  p.mesh(bowl, shadeMat(p, s.colour, true, 0.25), 0, s.h, 0, true);
  return p.build(new THREE.Vector3(0, s.h - r * 0.5, 0));
}

/** `drop` is the distance from the ceiling to the shade's underside (pendants only) */
export function buildLamp(shape: LampShape, drop = 1): BuiltLamp {
  switch (shape.type) {
    case 'globe':
      return globe(shape, drop);
    case 'drum':
      return drum(shape, drop);
    case 'dome':
      return dome(shape, drop);
    case 'arc':
      return arc(shape);
    case 'tripod':
      return tripod(shape);
    case 'uplight':
      return uplight(shape);
  }
}
