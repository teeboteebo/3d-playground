import * as THREE from 'three';
import type { RoomId } from '../data/catalog';

/** furthest a pointer may travel between press and release and still count as a click, in px */
const CLICK_SLOP = 5;

/** A press-and-release is a click (not an orbit drag or a pinch) when it barely moved and used one pointer. */
export function isClick(down: { x: number; y: number }, up: { x: number; y: number }, maxPointers: number): boolean {
  return maxPointers === 1 && Math.hypot(up.x - down.x, up.y - down.y) < CLICK_SLOP;
}

const ray = new THREE.Raycaster();

/** The room whose floor is under a point in normalised device coordinates, or null when it misses every floor. */
export function pickRoom(ndc: { x: number; y: number }, camera: THREE.Camera, floors: THREE.Object3D[]): RoomId | null {
  camera.updateMatrixWorld();
  ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const hit = ray.intersectObjects(floors, false)[0];
  return hit ? (hit.object.userData.room as RoomId) : null;
}
