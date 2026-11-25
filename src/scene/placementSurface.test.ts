import { expect, it } from 'vitest';
import { roomById } from '../data/rooms';
import { roomWalls } from './apartment';
import { roomSurface } from './placementSurface';

it('hits the far interior face through a cutaway, but never invents a wall across the open hall end', () => {
  const hall = roomById('hall'), walls = roomWalls(hall);
  const camera = { x: 2.8, y: 1, z: 4 };
  expect(roomSurface(hall, walls, camera, { x: 0, y: 0, z: -1 })).toMatchObject({ kind: 'wall', wall: { edge: 0 } });
  expect(roomSurface(hall, walls, { ...camera, z: 1 }, { x: 0, y: 0, z: 1 })).toBeNull();
  expect(roomSurface(hall, walls, camera, { x: 0, y: -0.5, z: -1 })).toEqual({ kind: 'floor' });
});
