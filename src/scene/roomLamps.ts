import * as THREE from 'three';
import { FLOOR_LAMPS, PENDANTS, findById } from '../data/catalog';
import { CEILING, centroid, roomById } from '../data/rooms';
import type { Settings } from '../state/settings';
import { buildLamp, type BuiltLamp } from './lamps';
import { CATALOG_LAMPS, type LampRoom } from '../data/roomDefs';
import type { ComponentState } from '../data/components';
import { tagOption } from './options';

/** Where each room's floor lamp stands, and the turn about y that points an arc lamp's reach (along +x at 0). */
export const FLOOR_LAMP_SPOT: Record<
  LampRoom<'floor'>,
  { x: number; z: number; rotY: number }
> = {
  /* between the sofa's east end (x 7.24) and the plant pot (x 7.96); rotY π points an arc lamp's reach back over
     the sofa, and a shade stands among the plant's leaves. */
  living: { x: 7.6, z: -1.2, rotY: Math.PI },
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

/** The catalog pendant and floor lamp of each room that has them, each with a warm light that comes on in the evening. */
export function addRoomLamps(parent: THREE.Object3D): RoomLamps {
  const placed = new Map<string, Placed>();

  function remove(key: string) {
    const p = placed.get(key);
    if (!p) return;
    parent.remove(p.lamp.group);
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
      light.position.copy(lamp.bulb);
      lamp.group.add(light);
      p = {
        id,
        lamp,
        light,
        intensity: drop === undefined ? FLOOR_INTENSITY : PENDANT_INTENSITY,
      };
      placed.set(name, p);
      parent.add(lamp.group);
    }
    return p;
  }

  return {
    apply(s) {
      const evening = s.time === 'eve';
      for (const { room, id, kind } of CATALOG_LAMPS) {
        const lamp: ComponentState = (s.rooms[room].components as Record<string, ComponentState>)[id];
        const pendant = kind === 'pendant';
        const name = pendant ? `${room}-pendant` : `${room}-floor-lamp`;
        const p = place(name, lamp.variant, pendant ? PENDANTS : FLOOR_LAMPS, pendant ? CEILING - PENDANT_HEIGHT : undefined);
        if (!p) continue;
        p.lamp.group.visible = lamp.shown;
        tagOption([p.lamp.group], room, [id]);
        if (pendant) {
          const [x, z] = centroid(roomById(room).poly);
          p.lamp.group.position.set(x, CEILING, z);
        } else {
          const { x, z, rotY } = FLOOR_LAMP_SPOT[room as LampRoom<'floor'>];
          p.lamp.group.position.set(x, 0, z);
          p.lamp.group.rotation.y = rotY;
        }
        const lit = evening && lamp.shown;
        p.light.intensity = lit ? p.intensity : 0;
        p.light.visible = lit;
        p.lamp.setGlow(lit);
      }
    },
    dispose() {
      for (const key of [...placed.keys()]) remove(key);
    },
  };
}
