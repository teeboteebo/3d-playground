import * as THREE from 'three';
import { FLOOR_LAMPS, PENDANTS, findById } from '../data/catalog';
import { CEILING, centroid, roomById } from '../data/rooms';
import type { Settings } from '../state/settings';
import { buildLamp, type BuiltLamp } from './lamps';

type LampRoom = 'living' | 'office';
const LAMP_ROOMS: LampRoom[] = ['living', 'office'];

/** Where each room's floor lamp stands, and the turn about y that points an arc lamp's reach (along +x at 0). */
export const FLOOR_LAMP_SPOT: Record<
  LampRoom,
  { x: number; z: number; rotY: number }
> = {
  /* at the sofa's west end, between the sofa (x 4.47-7.24, z -1.87...-0.08) and the String shelving (x 3.69-3.98);
     the east end is taken by a large plant. The base and legs stand clear of both; the widest shade (51 cm) hangs over
     the sofa arm, above it. With rotY 0 the arc's reach points along +x, over the sofa. */
  living: { x: 4.25, z: -1.2, rotY: 0 },
  /* past the desk's free end (the desk covers x 11.14-11.84, z -1.405...-0.205), against the back wall;
     the arc's reach points into the room */
  office: { x: 11.55, z: 0.1, rotY: Math.PI },
};

/** a pendant's shade hangs this high above the floor */
const PENDANT_HEIGHT = 2.1;
const PENDANT_INTENSITY = 0.9;
const FLOOR_INTENSITY = 0.6;

export interface RoomLamps {
  apply(s: Settings): void;
  dispose(): void;
}

interface Placed {
  id: string;
  lamp: BuiltLamp;
  light: THREE.PointLight;
  intensity: number;
}

/** The pendant and floor lamp chosen for the living room and the office, each with a warm light that comes on in the evening. */
export function addRoomLamps(parent: THREE.Object3D): RoomLamps {
  const placed = new Map<string, Placed>();

  function remove(key: string) {
    const p = placed.get(key);
    if (!p) return;
    parent.remove(p.lamp.group, p.light);
    p.lamp.dispose();
    p.light.dispose();
    placed.delete(key);
  }

  function place(
    name: string,
    id: string,
    list: typeof PENDANTS,
    drop: number | undefined,
  ) {
    const shape = findById(list, id).shape;
    if (!shape) {
      remove(name);
      return;
    }
    let p = placed.get(name);
    if (p?.id !== id) {
      remove(name);
      const lamp = buildLamp(shape, drop);
      lamp.group.name = name;
      const light = new THREE.PointLight(0xffc890, 0, 7, 1.3);
      light.name = `${name}-light`;
      light.castShadow = false;
      p = {
        id,
        lamp,
        light,
        intensity: drop === undefined ? FLOOR_INTENSITY : PENDANT_INTENSITY,
      };
      placed.set(name, p);
      parent.add(lamp.group, light);
    }
    return p;
  }

  return {
    apply(s) {
      const evening = s.time === 'eve';
      for (const room of LAMP_ROOMS) {
        const pendantName = `${room}-pendant`;
        const pendant = place(
          pendantName,
          s[room].pendant,
          PENDANTS,
          CEILING - PENDANT_HEIGHT,
        );
        if (pendant) {
          const [x, z] = centroid(roomById(room).poly);
          pendant.lamp.group.position.set(x, CEILING, z);
        }
        const floorName = `${room}-floor-lamp`;
        const floor = place(
          floorName,
          s[room].floorLamp,
          FLOOR_LAMPS,
          undefined,
        );
        if (floor) {
          const { x, z, rotY } = FLOOR_LAMP_SPOT[room];
          floor.lamp.group.position.set(x, 0, z);
          floor.lamp.group.rotation.y = rotY;
        }
        for (const p of [pendant, floor]) {
          if (!p) continue;
          p.lamp.group.updateMatrixWorld(true);
          p.light.position.copy(p.lamp.bulb).applyMatrix4(p.lamp.group.matrix);
          p.light.intensity = evening ? p.intensity : 0;
          p.light.visible = evening;
          p.lamp.setGlow(evening);
        }
      }
    },
    dispose() {
      for (const key of [...placed.keys()]) remove(key);
    },
  };
}
