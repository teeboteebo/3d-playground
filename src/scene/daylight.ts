import * as THREE from 'three';

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
