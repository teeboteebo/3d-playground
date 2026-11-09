import * as THREE from 'three';
import { ROOMS, centroid } from './apartment';

/** One warm, shadowless ceiling light per room around the bedroom, on in the evening so those rooms aren't black. */
export function addRoomLights(scene: THREE.Scene): { setEvening(on: boolean): void } {
  const lights = ROOMS.map((room) => {
    const [x, z] = centroid(room.poly);
    const l = new THREE.PointLight(0xffc890, 0, 8, 1.3);
    l.position.set(x, 2.6, z);
    scene.add(l);
    return l;
  });
  return {
    setEvening(on) {
      for (const l of lights) l.intensity = on ? 0.6 : 0;
    },
  };
}
