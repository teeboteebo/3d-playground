import { describe, expect, it } from 'vitest';
import { roomById } from '../data/rooms';
import { roomWalls } from './apartment';
import { changeWall, constrainedDelta, dragToSurface, motionFor, translateSelection, type MoveSelection } from './placementMove';
import type { PlacedLeaf } from './rigidPlacement';

const room = roomById('bedroom');
const walls = roomWalls(room);
const art: PlacedLeaf = {
  footprint: [[-0.25,-1.975],[0.25,-1.975],[0.25,-1.92],[-0.25,-1.92]],
  bottom: 1, top: 1.7, obstructs: true, mount: { kind: 'wall', edge: 0 },
};
const bench: PlacedLeaf = {
  ...art, footprint: [[-0.4,-1.9],[0.4,-1.9],[0.4,-1.5],[-0.4,-1.5]], bottom: 0, top: 0.8, mount: { kind: 'floor' },
};
const selection: MoveSelection = {
  room, tree: { root: ['set'], groups: { set: { name: 'Set', children: ['art','bench'] } } }, node: 'set',
  poses: new Map([['art',art],['bench',bench]]), components: {},
};
describe('moving a selection', () => {
  it('constrains a drag to the shared supports, including after prior moves', () => {
    const motion = motionFor(selection);
    if (motion.kind !== 'wall') throw Error(motion.kind);
    expect(constrainedDelta(motion, { x: 0.1, y: 0.5, z: 0.2 })).toEqual({ x: 0.1, y: 0, z: 0 });
    const move = translateSelection({ ...selection, components: { art: {
      variant: 'art', shown: true, options: {}, pose: { x: 0.2, y: 0.3, z: 0, yaw: 0 },
    } } }, { x: 0.1, y: 0, z: 0 });
    if (!move.ok) throw Error(move.reason);
    expect(move.transforms.get('art')!.x).toBeCloseTo(0.3);
    expect(move.transforms.get('art')!.y).toBe(0.3);
    expect(move.transforms.get('bench')!.x).toBe(0.1);
  });

  it('rotates the whole assembly onto a side wall and keeps the floor member on the floor', () => {
    const result = changeWall(selection, walls[1]);
    if (!result.ok) throw Error(result.reason);
    const mounted = result.leaves.get('art')!;
    expect(mounted.mount).toEqual({ kind: 'wall', edge: 1 });
    expect(Math.max(...mounted.footprint.map(([x]) => x))).toBeCloseTo(2.15);
    expect(mounted.bottom).toBe(1);
    const { support, ...a } = result.transforms.get('art')!;
    expect(support).toEqual({ kind: 'wall', edge: 1 });
    expect(a).toEqual(result.transforms.get('bench'));
    expect(result.leaves.get('bench')!.bottom).toBe(0);
  });

  it('finds a legal spot beside a door instead of mounting through it', () => {
    const result = changeWall(selection, walls[2]);
    if (!result.ok) throw Error(result.reason);
    const xs = result.leaves.get('art')!.footprint.map(([x]) => x);
    expect(Math.max(...xs)).toBeCloseTo(0.15);
    expect(result.leaves.get('art')!.bottom).toBe(art.bottom);
  });

  it('leaves a group with incompatible mounts intact', () => {
    const s = { ...selection, poses: new Map(selection.poses).set('bench', { ...bench, mount: { kind: 'wall-and-floor', edge: 1 } }) };
    expect(motionFor(s)).toMatchObject({ kind: 'blocked', reason: 'pinned' });
    expect(changeWall(s, walls[2])).toMatchObject({ ok: false });
  });

  it('transfers a mixed group without changing its spacing, including its hidden member', () => {
    const s = { ...selection, poses: new Map(selection.poses).set('bench', { ...bench, obstructs: false }) };
    const grab = { x: 0, y: 1.4, z: -1.92 };
    const mount = dragToSurface(s, motionFor(s), { kind: 'wall', wall: walls[1] }, grab, (p) => ({ x: p.x, y: 1.9, z: -0.75 }));
    if (!mount?.ok) throw Error('Group should fit left of the doorway');
    expect([...mount.leaves.values()].map((p) => p.mount)).toEqual([{ kind: 'wall', edge: 1 }, { kind: 'wall', edge: 1 }]);
    expect(mount.transforms.get('art')).toEqual(mount.transforms.get('bench'));
    expect(mount.leaves.get('art')!.bottom - mount.leaves.get('bench')!.bottom).toBeCloseTo(1);
    expect(Math.max(...mount.leaves.get('art')!.footprint.map(([x]) => x))).toBeCloseTo(2.15);
    const floor = dragToSurface({ ...s, poses: mount.leaves }, { kind: 'wall', wall: walls[1], lift: true, slide: true, canRemount: true },
      { kind: 'floor' }, { x: 2.1, y: 1.9, z: -0.75 }, (p) => ({ x: 0.8, y: p.y, z: 0 }));
    if (!floor?.ok) throw Error('Group should fit on the floor');
    expect(floor.leaves.get('bench')!.bottom).toBeCloseTo(0);
    expect(floor.leaves.get('art')!.bottom).toBeCloseTo(1);
    expect(floor.leaves.get('art')!.mount).toEqual({ kind: 'floor' });
  });

  it('rejects a floor-to-wall drop across a doorway rather than moving it to a different spot', () => {
    const s = { ...selection, node: 'bench' };
    const result = dragToSurface(s, motionFor(s), { kind: 'wall', wall: walls[1] }, { x: 0, y: 0.4, z: -1.7 },
      (p) => ({ x: p.x, y: 1.4, z: 1.15 }));
    expect(result).toMatchObject({ ok: false, member: 'bench', reason: 'opening' });
  });

  it('stops a whole floor group at the angled office corner reached by its hidden member', () => {
    const left: PlacedLeaf = { ...bench, footprint: [[10,0],[10.3,0],[10.3,0.3],[10,0.3]] };
    const right: PlacedLeaf = { ...left, obstructs: false, footprint: left.footprint.map(([x, z]) => [x + 0.5, z]) };
    const s = { ...selection, room: roomById('office'), poses: new Map([['art', left], ['bench', right]]) };
    const move = dragToSurface(s, motionFor(s), { kind: 'floor' }, { x: 10.1, y: 0.4, z: 0.1 },
      () => ({ x: 11.7, y: 0.4, z: 1.4 }));
    if (!move?.ok) throw Error('The floor group should fit in the corner');
    const [x, z] = move.leaves.get('bench')!.footprint[2];
    expect(x).toBeCloseTo(11.89);
    expect(z).toBeCloseTo(1.355);
    expect(move.transforms.get('art')).toEqual(move.transforms.get('bench'));
  });

  it('does not snap to a fictitious wall at the open end of the hall', () => {
    const leaf: PlacedLeaf = { ...bench, footprint: [[2.7,1],[3,1],[3,1.4],[2.7,1.4]] };
    const s = { ...selection, node: 'bench', room: roomById('hall'), poses: new Map([['bench', leaf]]) };
    const move = dragToSurface(s, motionFor(s), { kind: 'floor' }, { x: 2.8, y: 0.4, z: 1.2 },
      () => ({ x: 2.8, y: 0.4, z: 2.85 }));
    expect(move).toMatchObject({ ok: false, reason: 'outside' });
  });

  it('slides a mixed group along the seam without detaching either member', () => {
    const move = dragToSurface(selection, motionFor(selection), { kind: 'wall', wall: walls[0] },
      { x: 0, y: 1.4, z: -1.92 }, (p) => ({ ...p, x: 0.3, y: 1.42 }));
    if (!move?.ok) throw Error('The mixed group should slide along the wall');
    expect(move.leaves.get('art')!.mount).toEqual(art.mount);
    expect(move.leaves.get('bench')!.mount).toEqual(bench.mount);
    expect(move.transforms.get('art')).toEqual({ x: 0.3, y: 0, z: 0, yaw: 0 });
    expect(move.transforms.get('bench')).toEqual(move.transforms.get('art'));
  });
});
