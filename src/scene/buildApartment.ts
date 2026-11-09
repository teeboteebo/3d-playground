import * as THREE from 'three';
import { CEILING, OPENINGS, ROOMS, SKIRTING, roomWalls, type Opening, type Room, type Wall, type XZ } from './apartment';

export interface ApartmentMaterials {
  trim: THREE.Material;
  glass: THREE.Material;
  /** floor material for a room; the scene swaps its map when the floor tone changes */
  floor: (room: Room) => THREE.MeshStandardMaterial;
}

export interface Apartment {
  group: THREE.Group;
  /** one soft daylight per window, pointed into its room; intensities are set by the scene */
  windowLights: THREE.SpotLight[];
  /** per room: its wall material (recoloured by the scene) and its floor, with the outline's width and depth */
  rooms: Record<Room['id'], ApartmentRoom>;
}

export interface ApartmentRoom {
  wall: THREE.MeshStandardMaterial;
  floor: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  width: number;
  depth: number;
}

const lin = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();
const FRAME_W = 0.07;

/** Builds every room in ROOMS into one group. Walls are single-sided and face into their room, like the bedroom's. */
export function buildApartment(mats: ApartmentMaterials): Apartment {
  const group = new THREE.Group();
  group.name = 'apartment';
  const rooms = {} as Record<Room['id'], ApartmentRoom>;
  const windowLights: THREE.SpotLight[] = [];

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  /** a box placed in a wall's frame: u along the wall, v up, w out of the wall into the room */
  const wallBox = (wall: Wall, u: number, v: number, w: number, su: number, sv: number, sw: number, mat: THREE.Material) =>
    place(mesh(new THREE.BoxGeometry(su, sv, sw), mat), wall, u, v, w);

  for (const room of ROOMS) {
    const wallMat = new THREE.MeshStandardMaterial({ color: lin(room.wall), roughness: 0.95 });
    wallMat.shadowSide = THREE.DoubleSide;

    /* floor, and an invisible ceiling that still casts shadows so the sun only comes in through windows */
    const { minX, maxX, minZ, maxZ } = extent(room.poly);
    const floorGeo = flatShape(room.poly);
    const uv = floorGeo.attributes.uv;
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (pos.getX(i) - minX) / (maxX - minX), (maxZ - pos.getZ(i)) / (maxZ - minZ));
    }
    const floor = new THREE.Mesh(floorGeo, mats.floor(room));
    floor.receiveShadow = true;
    floor.name = `${room.id}-floor`;
    group.add(floor);
    rooms[room.id] = { wall: wallMat, floor, width: maxX - minX, depth: maxZ - minZ };
    const ceil = mesh(
      flatShape(room.poly, CEILING),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
    );
    ceil.receiveShadow = false;

    for (const wall of roomWalls(room)) {
      const m = mesh(wallGeometry(wall), wallMat);
      m.name = `${room.id}-wall`;
      /* skirting along the wall, broken by doorways */
      let u = 0;
      for (const h of [...wall.holes.filter((h) => h.opening.y0 < 0.01), { u0: wall.length, u1: wall.length }]) {
        if (h.u0 - u > 0.02) wallBox(wall, (u + h.u0) / 2, SKIRTING / 2, 0.01, h.u0 - u, SKIRTING, 0.02, mats.trim);
        u = h.u1;
      }
      for (const h of wall.holes) {
        const o = h.opening;
        if (o.kind === 'window') {
          windowLights.push(windowLight(wall, h.u0, h.u1, o));
          addWindow(wall, h.u0, h.u1, o);
        } else if (o.kind === 'door') {
          addDoor(wall, h.u0, h.u1, o);
        } else {
          architrave(wall, h.u0, h.u1, o.y1, 0.01);
        }
      }
    }
  }
  /* linings across the wall thickness of each passage, built once per passage */
  for (const o of OPENINGS.filter((p) => p.kind === 'passage')) addLining(o);

  function architrave(wall: Wall, u0: number, u1: number, top: number, w: number) {
    wallBox(wall, u0 - FRAME_W / 2, top / 2, w, FRAME_W, top + FRAME_W, 0.02, mats.trim);
    wallBox(wall, u1 + FRAME_W / 2, top / 2, w, FRAME_W, top + FRAME_W, 0.02, mats.trim);
    wallBox(wall, (u0 + u1) / 2, top + FRAME_W / 2, w, u1 - u0, FRAME_W, 0.02, mats.trim);
  }

  function addWindow(wall: Wall, u0: number, u1: number, o: Opening) {
    const W = u1 - u0;
    const H = o.y1 - o.y0;
    const uc = (u0 + u1) / 2;
    /* glass just outside the wall face, facing into the room */
    const glass = place(mesh(new THREE.PlaneGeometry(W, H), mats.glass, false), wall, uc, (o.y0 + o.y1) / 2, -0.03);
    glass.receiveShadow = false;
    /* frame, a centre mullion and a sill */
    wallBox(wall, u0 + FRAME_W / 2, (o.y0 + o.y1) / 2, 0.035, FRAME_W, H, 0.07, mats.trim);
    wallBox(wall, u1 - FRAME_W / 2, (o.y0 + o.y1) / 2, 0.035, FRAME_W, H, 0.07, mats.trim);
    wallBox(wall, uc, o.y1 - FRAME_W / 2, 0.035, W, FRAME_W, 0.07, mats.trim);
    wallBox(wall, uc, (o.y0 + o.y1) / 2, 0.02, 0.04, H, 0.03, mats.trim);
    wallBox(wall, uc, o.y0 - 0.02, 0.06, W + 0.2, 0.04, 0.16, mats.trim);
  }

  function addDoor(wall: Wall, u0: number, u1: number, o: Opening) {
    const W = u1 - u0;
    const uc = (u0 + u1) / 2;
    wallBox(wall, uc, o.y1 / 2, -0.02, W, o.y1, 0.04, mats.trim);
    wallBox(wall, uc, o.y1 * 0.68, 0.006, W - 0.2, o.y1 * 0.42, 0.012, mats.trim);
    wallBox(wall, uc, o.y1 * 0.25, 0.006, W - 0.2, o.y1 * 0.34, 0.012, mats.trim);
    architrave(wall, u0, u1, o.y1, 0.01);
  }

  function addLining(o: Opening) {
    const dx = o.b[0] - o.a[0];
    const dz = o.b[1] - o.a[1];
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(-dz, dx);
    const at = (t: number): XZ => [o.a[0] + (dx * t) / len, o.a[1] + (dz * t) / len];
    const piece = (t: number, y: number, sl: number, sy: number) => {
      const m = mesh(new THREE.BoxGeometry(sl, sy, o.depth), mats.trim);
      const [x, z] = at(t);
      m.position.set(x, y, z);
      m.rotation.y = angle;
    };
    piece(0.01, o.y1 / 2, 0.02, o.y1);
    piece(len - 0.01, o.y1 / 2, 0.02, o.y1);
    piece(len / 2, o.y1 - 0.01, len, 0.02);
  }

  return { group, windowLights, rooms };
}

/* ---------- geometry ---------- */

function extent(poly: readonly XZ[]) {
  return {
    minX: Math.min(...poly.map((p) => p[0])),
    maxX: Math.max(...poly.map((p) => p[0])),
    minZ: Math.min(...poly.map((p) => p[1])),
    maxZ: Math.max(...poly.map((p) => p[1])),
  };
}

/** a horizontal polygon at height y, facing up (floors) */
function flatShape(poly: readonly XZ[], y = 0): THREE.ShapeGeometry {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** maps a wall's local frame (u along a → b, v up, w into the room) to world space */
function wallFrame(wall: Wall): THREE.Matrix4 {
  const ux = (wall.b[0] - wall.a[0]) / wall.length;
  const uz = (wall.b[1] - wall.a[1]) / wall.length;
  return new THREE.Matrix4()
    .makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-uz, 0, ux))
    .setPosition(wall.a[0], 0, wall.a[1]);
}

/** puts an object at (u, v, w) in a wall's local frame, turned to match the wall */
function place<T extends THREE.Object3D>(o: T, wall: Wall, u: number, v: number, w: number): T {
  const f = wallFrame(wall);
  o.position.copy(new THREE.Vector3(u, v, w).applyMatrix4(f));
  o.quaternion.setFromRotationMatrix(f);
  return o;
}

/** the wall's face: full height, notched for doorways that reach the floor, with holes for windows */
function wallGeometry(wall: Wall): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (const h of wall.holes) {
    if (h.opening.y0 > 0.01) continue;
    s.lineTo(h.u0, 0);
    s.lineTo(h.u0, h.opening.y1);
    s.lineTo(h.u1, h.opening.y1);
    s.lineTo(h.u1, 0);
  }
  s.lineTo(wall.length, 0);
  s.lineTo(wall.length, CEILING);
  s.lineTo(0, CEILING);
  s.lineTo(0, 0);
  s.holes = wall.holes
    .filter((h) => h.opening.y0 > 0.01)
    .map((h) => {
      const p = new THREE.Path();
      p.moveTo(h.u0, h.opening.y0);
      p.lineTo(h.u1, h.opening.y0);
      p.lineTo(h.u1, h.opening.y1);
      p.lineTo(h.u0, h.opening.y1);
      p.lineTo(h.u0, h.opening.y0);
      return p;
    });
  const g = new THREE.ShapeGeometry(s);
  g.applyMatrix4(wallFrame(wall));
  return g;
}

/** soft daylight from just inside a window, aimed down and into the room */
function windowLight(wall: Wall, u0: number, u1: number, o: Opening): THREE.SpotLight {
  const f = wallFrame(wall);
  const uc = (u0 + u1) / 2;
  const l = new THREE.SpotLight(0xeef3ff, 0, 7.5, 1.15, 1, 1.6);
  l.position.copy(new THREE.Vector3(uc, Math.min(o.y1 - 0.4, 2.15), 0.32).applyMatrix4(f));
  l.target.position.copy(new THREE.Vector3(uc, 0.2, 2.6).applyMatrix4(f));
  return l;
}
