import * as THREE from 'three';
import { quebecRugTexture } from './textures';

/** ILVA Quebec kilim, 350 × 250 cm, about 1.5 cm thick */
const LENGTH = 3.5;
const WIDTH = 2.5;
const THICK = 0.015;

/**
 * The living-room rug, centred where the SketchUp model's rug lay, its length along the sofa and TV wall.
 * Returned as a group so the furniture loader can treat it like any loaded piece.
 */
export function quebecRug(): THREE.Group {
  const top = new THREE.MeshStandardMaterial({ map: quebecRugTexture(), roughness: 1 });
  const side = new THREE.MeshStandardMaterial({ color: new THREE.Color('#A9A091').convertSRGBToLinear(), roughness: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(LENGTH, THICK, WIDTH), [side, side, top, side, side, side]);
  mesh.position.set(5.976, THICK / 2, -0.01);
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}
