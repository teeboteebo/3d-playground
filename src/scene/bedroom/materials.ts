import * as THREE from 'three';
import { BRASS, CREAM, FLOOR, OAK, OAT, TRIM, WALL } from '../../data/catalog';
import { mixHex } from '../../lib/color';
import { lin, std } from '../materials';
import { floorTexture, mirrorTexture, woodTexture } from '../textures';
import { W } from './dimensions';

/** The materials the bedroom's parts share. Settings recolour several of them (walls, accent, pillows, frames). */
export function bedroomMaterials(accent: string) {
  const wall = std(WALL.hex, 0.95);
  wall.shadowSide = THREE.DoubleSide;
  const wardrobe = std(WALL.hex, 0.9);
  const curtain = new THREE.MeshStandardMaterial({
    color: lin(mixHex(OAT, '#000000', 0.12)), // fixed: slightly darker oatmeal linen
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const trim = std(TRIM.hex, 0.6);
  const woodTex = woodTexture(OAK.hex);
  const floor = new THREE.MeshStandardMaterial({ roughness: 0.42, map: floorTexture(FLOOR.hex, W) });
  const oak = new THREE.MeshStandardMaterial({ roughness: 0.6, map: woodTex });
  const oakDeep = new THREE.MeshStandardMaterial({ roughness: 0.65, color: new THREE.Color(0.8, 0.8, 0.8), map: woodTex });
  const brass = std(BRASS, 0.35, 0.55);
  const bedding = std(CREAM, 1);
  const mattress = std('#F2F0E8', 1);
  const throwBlanket = std('#C27D63', 1);
  const glass = new THREE.MeshBasicMaterial({ color: 0xdce8ee });
  const mirror = new THREE.MeshBasicMaterial({ map: mirrorTexture() });
  const frame = std(BRASS, 0.4, 0.4);
  const mat = std('#F4F1E6', 1);
  const art = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const shade = std('#F1ECDD', 0.9);
  const vase = std(accent, 0.8);
  const rugSide = std(OAT, 1);
  const pillows = [0, 1, 2, 3, 4].map(() => std(CREAM, 1));
  const mouldBed = std(CREAM, 0.7);
  const mouldDresser = std(CREAM, 0.7);
  return {
    wall, wardrobe, curtain, trim, floor, oak, oakDeep, brass, bedding, mattress, throwBlanket, glass, mirror, frame,
    mat, art, shade, vase, rugSide, pillows, mouldBed, mouldDresser,
  };
}

export type BedroomMaterials = ReturnType<typeof bedroomMaterials>;
