/// <reference types="node" />
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentDef, Mount } from '../data/components';
import { LIVING } from '../data/living';
import { roomById } from '../data/rooms';
import { defaultTree, groupSiblings, type RoomTree } from '../data/tree';
import { placePiece } from './furniture';
import { proposeRigidMove, type PlacedLeaf } from './rigidPlacement';
import { sideboard } from './sideboard';

const rect = (x: number, z: number, w: number, d: number, mount: Mount = { kind: 'floor' }): PlacedLeaf => ({
  footprint: [[x, z], [x + w, z], [x + w, z + d], [x, z + d]],
  bottom: 0, top: 0.8, mount, obstructs: true,
});

describe('rigid group movement', () => {
  it('keeps the real TV above its sideboard and rejects a move off either mount as a whole', async () => {
    // The sideboard needs a drawing context for its wood grain; use its actual built meshes for bounds.
    const ctx: unknown = new Proxy({}, { get: () => () => ({ addColorStop() {} }) });
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as CanvasRenderingContext2D);
    try {
      const bytes = readFileSync('public/models/living/tv.glb');
      const { scene: tv } = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
      placePiece('tv', tv);
      const nodes = new Map([['tv', tv], ['tv-bench', sideboard()]]);
      const room = roomById('living');
      const poses = new Map<string, PlacedLeaf>();
      for (const [id, node] of nodes) {
        const def: ComponentDef = LIVING.components.find((c) => c.id === id)!;
        const { min, max } = new THREE.Box3().setFromObject(node, true);
        poses.set(id, {
          ...rect(min.x, min.z, max.x - min.x, max.z - min.z, def.mount),
          bottom: min.y, top: max.y,
        });
      }
      const tree = groupSiblings(defaultTree(LIVING), [...nodes.keys()], 'media', 'TV and sideboard')!;
      const tvPose = poses.get('tv')!;
      const benchPose = poses.get('tv-bench')!;
      expect(tvPose.bottom - benchPose.top).toBeCloseTo(0.11);
      const move = proposeRigidMove(room, tree, 'media', poses, { x: 0.2, y: 0, z: 0 });
      expect(move.ok).toBe(true);
      if (!move.ok) throw new Error(move.reason);
      for (const [id, node] of nodes) {
        const original = poses.get(id)!;
        const next = move.leaves.get(id)!;
        expect(next.footprint).toEqual(original.footprint.map(([x, z]) => [x + 0.2, z]));
        expect(next.bottom).toBe(original.bottom);
        expect(new THREE.Box3().setFromObject(node, true).min.x).toBeCloseTo(original.footprint[0][0]);
      }
      expect(proposeRigidMove(room, tree, 'media', poses, { x: 0, y: 0, z: -0.2 })).toEqual({ ok: false, reason: 'wall', member: 'tv' });
      expect(proposeRigidMove(room, tree, 'media', poses, { x: 0, y: 0.1, z: 0 })).toEqual({ ok: false, reason: 'floor', member: 'tv-bench' });
    } finally {
      canvas.mockRestore();
    }
  });

  it('warns for solids but not a rug or the empty space between grouped pieces', () => {
    const poses = new Map([
      ['left', rect(-1.5, 0, 0.4, 0.3)], ['right', rect(1, 0, 0.4, 0.3)],
      ['obstacle', rect(0, 0.2, 0.4, 0.3)], ['rug', { ...rect(-2, 0.2, 4, 0.6), obstructs: false }],
    ]);
    const tree: RoomTree = { root: ['pair', 'rug', 'obstacle'], groups: { pair: { name: 'Tables', children: ['left', 'right'] } } };
    const move = (x: number) => proposeRigidMove(roomById('bedroom'), tree, 'pair', poses, { x, y: 0, z: 0.2 });
    expect(move(0)).toMatchObject({ ok: true, overlaps: [] });
    expect(move(-0.62)).toMatchObject({ ok: true, overlaps: ['obstacle'] });
  });

  it('checks the angled bay and blocks solid mounting patches over a doorway', () => {
    const box = new Map([['small', rect(8.0, 1.5, 0.2, 0.3)]]);
    expect(proposeRigidMove(roomById('living'), { root: ['small'], groups: {} }, 'small', box, { x: 0.3, y: 0, z: 0.35 })).toMatchObject({ ok: false, reason: 'outside' });
    const art = { ...rect(-1, 1.92, 0.4, 0.05, { kind: 'wall', edge: 2 }), bottom: 1.2, top: 1.8 };
    expect(proposeRigidMove(roomById('bedroom'), { root: ['art'], groups: {} }, 'art', new Map([['art', art]]), { x: 1, y: 0, z: 0 })).toMatchObject({ ok: false, reason: 'opening' });
  });

  it('does not move part of a group when a descendant is hidden and fixed, or not loaded', () => {
    const floor = rect(5, 0, 0.5, 0.5);
    const tree = {
      root: ['set'],
      groups: { set: { name: 'Set', children: ['floor', 'lighting'] }, lighting: { name: 'Lights', children: ['lamp', 'ceiling-light'] } },
    };
    const poses = new Map<string, PlacedLeaf>([['floor', floor], ['lamp', floor], ['ceiling-light', { ...floor, mount: { kind: 'fixed' }, obstructs: false }]]);
    const delta = { x: 0.25, y: 0, z: 0 };
    expect(proposeRigidMove(roomById('living'), tree, 'set', poses, delta)).toMatchObject({ ok: false, reason: 'fixed' });
    poses.delete('lamp');
    expect(proposeRigidMove(roomById('living'), tree, 'set', poses, delta)).toMatchObject({ ok: false, reason: 'unavailable', member: 'lamp' });
    expect(floor.footprint[0]).toEqual([5, 0]);
  });
});
