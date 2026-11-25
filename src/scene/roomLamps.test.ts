import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FLOOR_LAMPS, PENDANTS } from '../data/catalog';
import { ROOMS, centroid, roomById, type RoomId } from '../data/rooms';
import { DEFAULTS, type Settings } from '../state/settings';
import { optionOf } from './options';
import { DESK, DESK_X, DESK_Z } from './office/dimensions';
import { roomAt } from './pickRoom';
import { FLOOR_LAMP_SPOT, addRoomLamps } from './roomLamps';
import { addRoomLights } from './roomLights';

const P = PENDANTS[0].id,
  P2 = PENDANTS[1].id,
  F = FLOOR_LAMPS[0].id;
type Rooms = Settings['rooms'];
const withLamps = ({ office, living, ...over }: { time?: Settings['time']; office?: Rooms['office']; living?: Rooms['living'] }): Settings => ({
  ...DEFAULTS,
  ...over,
  rooms: { ...DEFAULTS.rooms, ...(office && { office }), ...(living && { living }) },
});
const office = (pendant: string | null, floorLamp: string | null): Rooms['office'] => ({
  ...DEFAULTS.rooms.office,
  components: {
    ...DEFAULTS.rooms.office.components,
    'ceiling-light': { shown: pendant !== null, variant: pendant ?? P, options: {} },
    'floor-lamp': { shown: floorLamp !== null, variant: floorLamp ?? F, options: {} },
  },
});
const living = (pendant: string | null, floorLamp: string | null): Rooms['living'] => ({
  ...DEFAULTS.rooms.living,
  components: {
    ...DEFAULTS.rooms.living.components,
    'ceiling-light': { shown: pendant !== null, variant: pendant ?? P, options: {} },
    'floor-lamp': { shown: floorLamp !== null, variant: floorLamp ?? F, options: {} },
  },
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
      withLamps({ office: office(P, null) }),
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
      withLamps({ living: living(P, F) }),
    );
    lamps.apply(
      withLamps({ living: living(P2, F) }),
    );
    expect(names(g)).toEqual([
      'living-floor-lamp',
      'living-pendant',
    ]);
    lamps.apply(DEFAULTS);
    expect(g.children).toHaveLength(0);
  });
  it('disposes the lamp it replaces and leaves an unchanged lamp alone', () => {
    const g = new THREE.Group();
    const lamps = addRoomLamps(g);
    lamps.apply(withLamps({ office: office(P, F) }));
    const oldPendant = g.getObjectByName('office-pendant')!;
    const floor = g.getObjectByName('office-floor-lamp')!;
    let freed = 0;
    oldPendant.traverse((o) => {
      if (o instanceof THREE.Mesh)
        vi.spyOn(o.geometry, 'dispose').mockImplementation(() => {
          freed++;
        });
    });
    lamps.apply(withLamps({ office: office(P2, F) }));
    expect(freed).toBeGreaterThan(0);
    expect(g.getObjectByName('office-floor-lamp')).toBe(floor);
  });
  it('lights the lamps only in the evening', () => {
    const g = new THREE.Group();
    const lamps = addRoomLamps(g);
    lamps.apply(
      withLamps({ time: 'day', office: office(P, F) }),
    );
    expect(light(g, 'office-pendant-light').intensity).toBe(0);
    expect(light(g, 'office-pendant-light').visible).toBe(false);
    expect(light(g, 'office-floor-lamp-light').visible).toBe(false);
    lamps.apply(
      withLamps({ time: 'eve', office: office(P, F) }),
    );
    expect(light(g, 'office-pendant-light').intensity).toBe(0.9);
    expect(light(g, 'office-floor-lamp-light').intensity).toBe(0.6);
    expect(light(g, 'office-pendant-light').visible).toBe(true);
    expect(light(g, 'office-floor-lamp-light').visible).toBe(true);
    expect(light(g, 'office-pendant-light').castShadow).toBe(false);
  });
  it("turns off a hidden office lamp's light in the evening", () => {
    const g = new THREE.Group();
    const lamps = addRoomLamps(g);
    lamps.apply(withLamps({ time: 'eve', office: office(P, null) }));
    expect(g.getObjectByName('office-pendant')).toBeDefined();
    expect(light(g, 'office-pendant-light').visible).toBe(true);
    lamps.apply(withLamps({ time: 'eve', office: office(null, null) }));
    expect(g.getObjectByName('office-pendant')).toBeUndefined();
    expect(g.getObjectByName('office-pendant-light')).toBeUndefined();
  });
  it('tags the lamps of both rooms as the ceiling light and the floor lamp', () => {
    const g = new THREE.Group();
    addRoomLamps(g).apply(withLamps({ living: living(P, F), office: office(P, F) }));
    for (const room of ['living', 'office']) {
      expect(optionOf(g.getObjectByName(`${room}-pendant`)!)).toEqual({ room, path: ['ceiling-light'] });
      expect(optionOf(g.getObjectByName(`${room}-floor-lamp`)!)).toEqual({ room, path: ['floor-lamp'] });
      const lamp = g.getObjectByName(`${room}-floor-lamp`)!;
      const source = light(g, `${room}-floor-lamp-light`);
      const before = source.getWorldPosition(new THREE.Vector3());
      lamp.position.z += 0.2;
      expect(source.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(before.z + 0.2);
    }
  });
  it('lights the living room from its components', () => {
    const g = new THREE.Group();
    addRoomLamps(g).apply(withLamps({ time: 'eve', living: living(P, null) }));
    expect(g.getObjectByName('living-pendant')).toBeDefined();
    expect(g.getObjectByName('living-floor-lamp')).toBeUndefined();
  });
  it('stands the living floor lamp between the sofa and the plant pot', () => {
    const g = new THREE.Group();
    addRoomLamps(g).apply(
      withLamps({ living: living(null, 'kona') }),
    );
    const lamp = g.getObjectByName('living-floor-lamp') as THREE.Object3D;
    lamp.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let low = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    lamp.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.castShadow) return;
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (v.y >= 0.6) continue;
        low++;
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
      }
    });
    expect(low).toBeGreaterThan(0);
    expect(minX).toBeGreaterThan(7.24);
    expect(maxX).toBeLessThan(7.96);
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
      withLamps({ time: 'eve', office: office(P, null) }),
    );
    expect([
      at('hall').intensity,
      at('living').intensity,
      at('office').intensity,
    ]).toEqual([0.6, 0.6, 0.15]);
    fill.apply(withLamps({ time: 'eve', living: living(null, F) }));
    expect(at('living').intensity).toBe(0.15);
    fill.apply(
      withLamps({ time: 'day', office: office(P, null) }),
    );
    expect(at('office').intensity).toBe(0);
  });
  it('keeps the fill of a room without catalog lamps at full strength, and leaves the bedroom without one', () => {
    const scene = new THREE.Scene();
    const fill = addRoomLights(scene);
    fill.apply(withLamps({ time: 'eve', office: office(P, F), living: living(P, F) }));
    expect(scene.children.find((l) => l.name === 'hall-fill')).toHaveProperty('intensity', 0.6);
    expect(scene.children.find((l) => l.name === 'bedroom-fill')).toBeUndefined();
  });
});
