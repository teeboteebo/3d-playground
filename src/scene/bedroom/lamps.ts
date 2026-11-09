import * as THREE from 'three';

/**
 * An evening lamp's light. The bulb sits inside its shade and the shade casts (heavily blurred) shadows, so the
 * lamp throws a pool of light down and a cone up the wall. A second, shadowless glow light stands in for the light
 * a fabric or paper shade lets through, so the cone edges fade instead of cutting to dark. Long reach and gentle
 * decay let each lamp's light blend into the next instead of forming its own pool.
 */
export interface Bulb {
  key: THREE.PointLight;
  glow: THREE.PointLight;
  /** key and glow intensity when on; 0 and no shadow when off */
  set(on: boolean): void;
  moveX(x: number): void;
}

export function bulb(parent: THREE.Object3D, x: number, y: number, z: number, distance: number, key: number, glow: number): Bulb {
  const k = new THREE.PointLight(0xffb978, 0, distance, 1.3);
  k.position.set(x, y, z);
  k.shadow.mapSize.set(256, 256);
  k.shadow.radius = 16;
  k.shadow.camera.near = 0.02;
  k.shadow.camera.far = distance;
  k.shadow.bias = -0.003;
  const g = new THREE.PointLight(0xffc48a, 0, distance, 1.3);
  g.position.set(x, y, z);
  parent.add(k, g);
  return {
    key: k,
    glow: g,
    set(on) {
      k.intensity = on ? key : 0;
      g.intensity = on ? glow : 0;
      /* only lights that are on render shadow maps (point-light shadows cost six passes each) */
      k.castShadow = on;
    },
    moveX(nx) {
      k.position.x = nx;
      g.position.x = nx;
    },
  };
}

/** a lamp shade that glows warm in the evening */
export function glowShade(mat: THREE.MeshStandardMaterial, on: boolean, colour = 0xffb35e, intensity = 0.9): void {
  mat.emissive.set(on ? colour : 0x000000);
  mat.emissiveIntensity = on ? intensity : 0;
}
