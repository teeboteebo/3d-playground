import * as THREE from "three";
import { ROOMS, centroid, type RoomId } from "../data/rooms";
import type { Settings } from "../state/settings";

/** the rooms whose fill light gives way to their lamps */
const LAMPLIT: RoomId[] = ["living", "office"];

/**
 * One warm, shadowless ceiling light per room around the bedroom, on in the evening so those rooms aren't black.
 * Where a lamp is chosen the fill drops to a faint glow and the lamp does the lighting.
 */
export function addRoomLights(scene: THREE.Scene): {
  apply(s: Settings): void;
} {
  const lights = ROOMS.filter((r) => r.id !== "bedroom").map((room) => {
    const [x, z] = centroid(room.poly);
    const l = new THREE.PointLight(0xffc890, 0, 8, 1.3);
    l.name = `${room.id}-fill`;
    l.position.set(x, 2.6, z);
    scene.add(l);
    return { id: room.id, light: l };
  });
  return {
    apply(s) {
      const evening = s.time === "eve";
      for (const { id, light } of lights) {
        const lit =
          LAMPLIT.includes(id) &&
          (s[id as "living" | "office"].pendant !== "none" ||
            s[id as "living" | "office"].floorLamp !== "none");
        light.intensity = !evening ? 0 : lit ? 0.15 : 0.6;
      }
    },
  };
}
