import * as THREE from 'three';
import { ROOMS, centroid } from '../data/rooms';
import type { Settings } from '../state/settings';

/**
 * One warm, shadowless ceiling light per room around the bedroom, on in the evening so those rooms aren't black.
 * In the living room and office the fill drops to a faint glow once a lamp is chosen, and the lamp does the lighting.
 */
export function addRoomLights(scene: THREE.Scene): { apply(s: Settings): void } {
  const lights = ROOMS.filter((r) => r.id !== 'bedroom').map((room) => {
    const [x, z] = centroid(room.poly);
    const l = new THREE.PointLight(0xffc890, 0, 8, 1.3);
    l.name = `${room.id}-fill`;
    l.position.set(x, 2.6, z);
    scene.add(l);
    return { id: room.id, light: l };
  });
  return {
    apply(s) {
      const evening = s.time === 'eve';
      for (const { id, light } of lights) {
        const lamps = id === 'living' || id === 'office' ? s[id] : null;
        const lit = !!lamps && (lamps.pendant !== 'none' || lamps.floorLamp !== 'none');
        light.intensity = !evening ? 0 : lit ? 0.15 : 0.6;
      }
    },
  };
}
