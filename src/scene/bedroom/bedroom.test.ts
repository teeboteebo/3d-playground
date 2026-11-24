import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BEDROOM, type BedroomComponentId } from '../../data/bedroom';
import { DEFAULTS, applyPatch, type Settings } from '../../state/settings';
import { lin } from '../materials';
import { optionOf } from '../options';
import { buildBedroom } from '.';
import { L } from './dimensions';

/* jsdom has no 2D canvas: the textures only need something that swallows every drawing call */
beforeAll(() => {
  const ctx: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : ctx),
    set: () => true,
    apply: () => ctx,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
});

/** a mesh is on screen when it and all its parents are visible */
const on = (o: THREE.Object3D): boolean => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};
const IDS = BEDROOM.components.map((c) => c.id) as BedroomComponentId[];
const FRONT_VIEW = new THREE.Vector3(0, 1.5, 0);
const BEHIND_FRONT_WALL = new THREE.Vector3(0, 1.5, L / 2 + 2);

const patch = (components: Partial<Record<BedroomComponentId, object>>, extra: Record<string, unknown> = {}): Settings =>
  applyPatch(DEFAULTS, { rooms: { bedroom: { components, ...extra } } } as never);
const hide = (...ids: BedroomComponentId[]) => patch(Object.fromEntries(ids.map((id) => [id, { shown: false }])));
const evening = (s: Settings): Settings => ({ ...s, time: 'eve' });

function build(accent = '#B5654A') {
  const parent = new THREE.Group();
  const room = buildBedroom(parent, accent);
  room.apply(DEFAULTS);
  room.showFrom(FRONT_VIEW);
  const meshesOf = (id: string) => {
    const found: THREE.Mesh[] = [];
    parent.traverse((o) => {
      if (o instanceof THREE.Mesh && optionOf(o)?.path[0] === id) found.push(o);
    });
    return found;
  };
  /** every mesh's visibility with its ancestors' */
  const visibility = () => {
    const map = new Map<THREE.Object3D, boolean>();
    parent.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      let on = true;
      for (let p: THREE.Object3D | null = o; p && p !== parent.parent; p = p.parent) on &&= p.visible;
      map.set(o, on);
    });
    return map;
  };
  const lights = () => {
    const found: THREE.PointLight[] = [];
    parent.traverse((o) => o instanceof THREE.PointLight && found.push(o));
    return found;
  };
  return { parent, room, meshesOf, visibility, lights };
}

describe('the bedroom scene targets', () => {
  it('has real meshes for each of the ten slots, and none for anything else', () => {
    const { meshesOf, parent } = build();
    for (const id of IDS) expect(meshesOf(id).length, id).toBeGreaterThan(0);
    const tagged = new Set<string>();
    parent.traverse((o) => {
      const opt = o instanceof THREE.Mesh ? optionOf(o) : null;
      if (opt?.room === 'bedroom') tagged.add(opt.path[0]);
    });
    expect([...tagged].sort()).toEqual([...IDS, 'moulding'].sort());
  });

  it.each(IDS)('hides and shows %s on its own, and nothing else', (id) => {
    const { room, meshesOf, visibility } = build();
    const before = visibility();
    room.apply(hide(id));
    const hidden = visibility();
    const own = new Set<THREE.Object3D>(meshesOf(id));
    for (const [mesh, on] of hidden) expect(on, `${id}: ${mesh.name || mesh.uuid}`).toBe(own.has(mesh) ? false : before.get(mesh));
    room.apply(DEFAULTS);
    expect(visibility()).toEqual(before);
  });

  it('puts everything on the dresser, the vase included, under the dresser', () => {
    const { room, meshesOf } = build();
    room.apply(patch({}, { accent: '#2F5D62' }));
    const colours = meshesOf('dresser').map((m) => (m.material as THREE.MeshStandardMaterial).color);
    expect(colours.some((c) => c.equals(lin('#2F5D62')))).toBe(true);
    room.apply(hide('dresser'));
    expect(meshesOf('dresser').every((m) => !on(m))).toBe(true);
    expect(meshesOf('accent')).toHaveLength(0);
  });

  it('repaints the vase when the accent changes, while the dresser is hidden or not', () => {
    const { room, meshesOf } = build();
    room.apply(patch({}, { accent: '#2F5D62' }));
    const colours = () => meshesOf('dresser').map((m) => (m.material as THREE.MeshStandardMaterial).color);
    expect(colours().some((c) => c.equals(lin('#2F5D62')))).toBe(true);
  });

  it('shows the rug as its real product, with no bare floor product', () => {
    const { room, meshesOf } = build();
    const rug = meshesOf('rug')[0];
    expect(on(rug)).toBe(true);
    room.apply(patch({ rug: { shown: false } }));
    expect(on(rug)).toBe(false);
    room.apply(patch({ rug: { shown: true, variant: 'palma' } }));
    expect(on(rug)).toBe(true);
  });
});

describe('the bedroom with the camera looking through a wall', () => {
  it('hides the painting and the mirror behind the front wall, and shows them back with the room\'s settings', () => {
    const { room, meshesOf } = build();
    room.showFrom(BEHIND_FRONT_WALL);
    expect(meshesOf('painting').every((m) => !on(m))).toBe(true);
    expect(meshesOf('mirror').every((m) => !on(m))).toBe(true);
    room.showFrom(FRONT_VIEW);
    expect(meshesOf('painting').every((m) => on(m))).toBe(true);
    expect(meshesOf('mirror').every((m) => on(m))).toBe(true);
  });

  it('keeps a hidden painting and mirror hidden when the camera comes back', () => {
    const { room, meshesOf } = build();
    room.apply(hide('painting', 'mirror'));
    for (const cam of [BEHIND_FRONT_WALL, FRONT_VIEW, BEHIND_FRONT_WALL, FRONT_VIEW]) {
      room.showFrom(cam);
      expect(meshesOf('painting').some((m) => on(m))).toBe(false);
      expect(meshesOf('mirror').some((m) => on(m))).toBe(false);
    }
  });

  it('does not bring a hidden piece back when the settings change under a cutaway camera', () => {
    const { room, meshesOf } = build();
    room.showFrom(BEHIND_FRONT_WALL);
    room.apply(hide('painting'));
    room.showFrom(FRONT_VIEW);
    expect(meshesOf('painting').some((m) => on(m))).toBe(false);
    room.apply(DEFAULTS);
    expect(meshesOf('painting').every((m) => on(m))).toBe(true);
  });

  it('hides a piece the camera cuts away even when it is shown, until the camera is back', () => {
    const { room, meshesOf } = build();
    room.apply(DEFAULTS);
    room.showFrom(BEHIND_FRONT_WALL);
    room.apply(patch({ painting: { shown: true } }));
    expect(meshesOf('painting').some((m) => on(m))).toBe(false);
  });
});

describe('the bedroom lights in the evening', () => {
  /** the intensity of each light, by what it is: dresser lamp, bedside lamps, pendant */
  function levels(parent: THREE.Object3D, lights: THREE.PointLight[]) {
    const keys = lights.filter((l) => l.parent === parent);
    return {
      pendant: keys.filter((l) => l.intensity === 0.7 || (l.position.x === 0 && l.distance === 9)).map((l) => l.intensity),
      dresser: keys.filter((l) => l.distance === 8).map((l) => l.intensity),
      bedside: keys.filter((l) => l.distance === 7).map((l) => l.intensity),
    };
  }

  it('burns each light for its own piece only', () => {
    const { parent, room, lights } = build();
    room.apply(evening(DEFAULTS));
    expect(levels(parent, lights())).toEqual({ pendant: [0.7], dresser: [0.55, 0.5], bedside: [0.35, 0.35, 0.35, 0.35] });

    room.apply(evening(hide('dresser')));
    expect(levels(parent, lights())).toEqual({ pendant: [0.7], dresser: [0, 0], bedside: [0.35, 0.35, 0.35, 0.35] });

    room.apply(evening(hide('bedside-lamps')));
    expect(levels(parent, lights())).toEqual({ pendant: [0.7], dresser: [0.55, 0.5], bedside: [0, 0, 0, 0] });

    room.apply(evening(hide('ceiling-light')));
    expect(levels(parent, lights())).toEqual({ pendant: [0], dresser: [0.55, 0.5], bedside: [0.35, 0.35, 0.35, 0.35] });
  });

  it('does not put out a lamp when its table is hidden, or the tables when the lamps are', () => {
    const { parent, room, lights, meshesOf } = build();
    room.apply(evening(hide('bedside-tables')));
    expect(levels(parent, lights()).bedside).toEqual([0.35, 0.35, 0.35, 0.35]);
    room.apply(evening(hide('bedside-lamps')));
    expect(meshesOf('bedside-tables').every((m) => on(m))).toBe(true);
  });

  it('keeps every light dark by day, shown or not', () => {
    const { parent, room, lights } = build();
    room.apply(DEFAULTS);
    expect(levels(parent, lights())).toEqual({ pendant: [0], dresser: [0, 0], bedside: [0, 0, 0, 0] });
  });

  it('casts shadows only from the lights that are on', () => {
    const { room, lights } = build();
    room.apply(evening(hide('dresser', 'bedside-lamps', 'ceiling-light')));
    expect(lights().some((l) => l.castShadow)).toBe(false);
  });
});
