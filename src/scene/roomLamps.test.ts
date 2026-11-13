import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FLOOR_LAMPS, PENDANTS } from '../data/catalog';
import { ROOMS, centroid, roomById, type RoomId } from '../data/rooms';
import { DEFAULTS, type Settings } from '../state/settings';
import { DESK, DESK_X, DESK_Z } from './office/dimensions';
import { roomAt } from './pickRoom';
import { FLOOR_LAMP_SPOT, addRoomLamps } from './roomLamps';
import { addRoomLights } from './roomLights';

const P = PENDANTS[1].id,
  P2 = PENDANTS[2].id,
  F = FLOOR_LAMPS[1].id;
const withLamps = (over: Partial<Settings>): Settings => ({
  ...DEFAULTS,
  ...over,
});
const names = (g: THREE.Object3D) => g.children.map((c) => c.name).sort();
const light = (g: THREE.Object3D, n: string) =>
  g.getObjectByName(n) as THREE.PointLight;

describe('addRoomLamps', () => {
  it('adds nothing with the default settings', () => {
    const g = new THREE.Group();
    addRoomLamps(g).apply(DEFAULTS);
    expect(g.children).toHaveLength(0);
  });
  it('hangs the pendant at the room centre, 2.1 m above the floor', () => {
    const g = new THREE.Group();
    addRoomLamps(g).apply(
      withLamps({ office: { pendant: P, floorLamp: 'none' } }),
    );
    const p = g.getObjectByName('office-pendant')!;
    const [cx, cz] = centroid(roomById('office').poly);
    expect([p.position.x, p.position.z]).toEqual([cx, cz]);
    expect(new THREE.Box3().setFromObject(p).min.y).toBeCloseTo(2.1, 2);
  });
  it('keeps one pendant and one floor lamp per room when switching', () => {
    const g = new THREE.Group();
    const lamps = addRoomLamps(g);
    lamps.apply(
      withLamps({ living: { hidden: [], pendant: P, floorLamp: F } }),
    );
    lamps.apply(
      withLamps({ living: { hidden: [], pendant: P2, floorLamp: F } }),
    );
    expect(names(g)).toEqual([
      'living-floor-lamp',
      'living-floor-lamp-light',
      'living-pendant',
      'living-pendant-light',
    ]);
    lamps.apply(DEFAULTS);
    expect(g.children).toHaveLength(0);
  });
  it('disposes the lamp it replaces and leaves an unchanged lamp alone', () => {
    const g = new THREE.Group();
    const lamps = addRoomLamps(g);
    lamps.apply(withLamps({ office: { pendant: P, floorLamp: F } }));
    const oldPendant = g.getObjectByName('office-pendant')!;
    const floor = g.getObjectByName('office-floor-lamp')!;
    let freed = 0;
    oldPendant.traverse((o) => {
      if (o instanceof THREE.Mesh)
        vi.spyOn(o.geometry, 'dispose').mockImplementation(() => {
          freed++;
        });
    });
    lamps.apply(withLamps({ office: { pendant: P2, floorLamp: F } }));
    expect(freed).toBeGreaterThan(0);
    expect(g.getObjectByName('office-floor-lamp')).toBe(floor);
  });
  it('lights the lamps only in the evening', () => {
    const g = new THREE.Group();
    const lamps = addRoomLamps(g);
    lamps.apply(
      withLamps({ time: 'day', office: { pendant: P, floorLamp: F } }),
    );
    expect(light(g, 'office-pendant-light').intensity).toBe(0);
    lamps.apply(
      withLamps({ time: 'eve', office: { pendant: P, floorLamp: F } }),
    );
    expect(light(g, 'office-pendant-light').intensity).toBe(0.9);
    expect(light(g, 'office-floor-lamp-light').intensity).toBe(0.6);
    expect(light(g, 'office-pendant-light').castShadow).toBe(false);
  });
  it('stands each floor lamp inside its room', () => {
    for (const room of ['living', 'office'] as const) {
      const { x, z } = FLOOR_LAMP_SPOT[room];
      expect(roomAt(x, z, ROOMS)).toBe(room);
    }
  });
  it('keeps the office floor lamp clear of the desk', () => {
    const { x, z } = FLOOR_LAMP_SPOT.office;
    const inX = Math.abs(x - DESK_X) < DESK.d / 2;
    const zGap = Math.abs(z - DESK_Z) - DESK.w / 2;
    expect(inX && zGap < 0.2).toBe(false);
    expect(zGap).toBeGreaterThanOrEqual(0.2);
  });
});

describe('addRoomLights', () => {
  it('dims the fill light only in a room with a lamp chosen', () => {
    const scene = new THREE.Scene();
    const fill = addRoomLights(scene);
    const at = (id: RoomId) =>
      scene.children.find((l) => l.name === `${id}-fill`) as THREE.PointLight;
    fill.apply(withLamps({ time: 'eve' }));
    expect([
      at('hall').intensity,
      at('living').intensity,
      at('office').intensity,
    ]).toEqual([0.6, 0.6, 0.6]);
    fill.apply(
      withLamps({ time: 'eve', office: { pendant: P, floorLamp: 'none' } }),
    );
    expect([
      at('hall').intensity,
      at('living').intensity,
      at('office').intensity,
    ]).toEqual([0.6, 0.6, 0.15]);
    fill.apply(
      withLamps({ time: 'day', office: { pendant: P, floorLamp: 'none' } }),
    );
    expect(at('office').intensity).toBe(0);
  });
});
