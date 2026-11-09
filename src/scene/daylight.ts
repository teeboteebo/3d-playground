import * as THREE from 'three';
import { CEILING, apartmentBounds } from '../data/rooms';

export const DAYLIGHT_COLOUR = 0xeef3ff;
export const MOONLIGHT_COLOUR = 0x8ea6d6;

/**
 * Soft daylight spilling in through a window: a wide, soft-edged spot that falls off across the room, so the
 * window side reads bright and the far side goes dim. Off (intensity 0) until the scene sets the time of day.
 */
export function windowSpot(position: THREE.Vector3, target: THREE.Vector3): THREE.SpotLight {
  const l = new THREE.SpotLight(DAYLIGHT_COLOUR, 0, 7.5, 1.15, 1, 1.6);
  l.position.copy(position);
  l.target.position.copy(target);
  return l;
}

/** day: strong daylight through every window; evening: faint, cool moonlight */
export function setWindowSpot(l: THREE.SpotLight, evening: boolean): void {
  l.intensity = evening ? 0.18 : 1.6;
  l.color.set(evening ? MOONLIGHT_COLOUR : DAYLIGHT_COLOUR);
}

/**
 * The sky and the sun. In daylight a strong low sun through the windows does most of the work, with a dim sky fill
 * so corners, the far side of furniture and the floor under the bed fall into real shade. In the evening the sun is
 * off and the sky becomes warm bounce light off the lamp-lit walls and ceiling.
 */
export function addSkyAndSun(scene: THREE.Scene): { setEvening(evening: boolean): void } {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8a98c, 0.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 0.9);
  sun.position.set(-7, 5, -0.8);
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.radius = 1;
  /* the sun's shadow box has to cover the whole apartment (every room's ceiling and walls block it),
     otherwise anything outside the box is treated as sunlit. Fit it to the apartment as the sun sees it. */
  const b = apartmentBounds();
  const view = new THREE.Matrix4().lookAt(sun.position, sun.target.position, new THREE.Vector3(0, 1, 0));
  view.setPosition(sun.position).invert();
  const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
  const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const x of [b.minX, b.maxX]) for (const y of [0, CEILING]) for (const z of [b.minZ, b.maxZ]) {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(view);
    lo.min(p);
    hi.max(p);
  }
  const margin = 0.5;
  Object.assign(sun.shadow.camera, {
    left: lo.x - margin, right: hi.x + margin, bottom: lo.y - margin, top: hi.y + margin, near: 0.5, far: -lo.z + margin,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;

  return {
    setEvening(evening) {
      sun.intensity = evening ? 0 : 1.6;
      sun.castShadow = !evening;
      hemi.intensity = evening ? 0.3 : 0.26;
      hemi.color.set(evening ? 0xa68a6c : 0xdfe8f2);
      hemi.groundColor.set(evening ? 0x5c4836 : 0xb8a98c);
    },
  };
}
