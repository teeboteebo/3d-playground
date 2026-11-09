import * as THREE from 'three';
import {
  BRASS, CREAM, FLOOR, FRAMES, INK, OAK, OAT, PAINTS, RUG_SIZE, RUGS, TRIM, VIEWS, WALL, findById, type RoomId,
  type CameraPose,
} from '../data/catalog';
import { mixHex } from '../lib/color';
import type { Settings } from '../state/settings';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { BEDROOM_POLY, CEILING, ROOMS, apartmentBounds } from './apartment';
import { buildApartment } from './buildApartment';
import { loadFurniture } from './furniture';
import { isClick, pickRoom } from './pickRoom';
import { addRoomLights } from './roomLights';
import { bedWallLayout } from './layout';
import { pillowColours } from './palette';
import { quebecRug } from './quebecRug';
import {
  artTexture, canvasTexture, floorTexture, getRugCanvases, mirrorTexture, weaveTexture, woodTexture,
} from './textures';

export interface BedroomScene {
  apply(settings: Settings): void;
  /** ease the camera to a pose; fields left out (e.g. the rotation) stay as they are */
  setView(pose: Partial<CameraPose>): void;
  dispose(): void;
}

export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL is not available');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

/* Room dimensions (metres). */
const W = 4.3;
const L = 3.95;
const H = 3.3;
const BEDX = (-W / 2 + (W / 2 - 0.58)) / 2;
const RAIL_Y = 0.75;
/* lower moulding panels run from just above the skirting to just under the rail */
const LOW_Y0 = 0.28;
const LOW_Y1 = RAIL_Y - 0.08;
const FRAME_T = 0.028;
/* Mio Adina wall lamp: centre height of its shade, and how far its stem (and the shade's axis) stands off the wall */
const ADINA_SHADE_Y = 1.35;
const ADINA_STEM_OUT = 0.105;

const lin = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();
const std = (hex: string, rough = 0.9, metal = 0) =>
  new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough, metalness: metal });
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function createBedroomScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  initial: Settings,
  /** called with the room under a click (not a drag), or null for a click outside the apartment */
  onPick?: (room: RoomId | null) => void,
): BedroomScene {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    throw new WebGLUnavailableError(e);
  }
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  /* plain PCF filters over each light's shadow.radius, so shadow edges come out soft
     (PCFSoftShadowMap ignores radius in this three.js version and gives razor-sharp edges) */
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  let current = initial;

  /* ---------- materials ---------- */
  const wallMat = std(WALL.hex, 0.95);
  wallMat.shadowSide = THREE.DoubleSide;
  const wardMat = std(WALL.hex, 0.9);
  const curtainMat = new THREE.MeshStandardMaterial({
    color: lin(mixHex(OAT, '#000000', 0.12)), // fixed: slightly darker oatmeal linen
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const trimMat = std(TRIM.hex, 0.6);
  const woodTex = woodTexture(OAK.hex);
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.42, map: floorTexture(FLOOR.hex, W) });
  const oakMat = new THREE.MeshStandardMaterial({ roughness: 0.6, map: woodTex });
  const oakDeepMat = new THREE.MeshStandardMaterial({ roughness: 0.65, color: new THREE.Color(0.8, 0.8, 0.8), map: woodTex });
  const brassMat = std(BRASS, 0.35, 0.55);
  const beddingMat = std(CREAM, 1);
  const mattressMat = std('#F2F0E8', 1);
  const throwMat = std('#C27D63', 1);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xdce8ee });
  const mirrorMat = new THREE.MeshBasicMaterial({ map: mirrorTexture() });
  const frameMat = std(BRASS, 0.4, 0.4);
  const matMat = std('#F4F1E6', 1);
  const artMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const shadeMat = std('#F1ECDD', 0.9);
  const vaseMat = std(current.accent, 0.8);
  const rugSide = std(OAT, 1);
  const pillowMats = [0, 1, 2, 3, 4].map(() => std(CREAM, 1));
  const mouldMat = std(CREAM, 0.7);
  const mouldFMat = std(CREAM, 0.7);

  function add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, noCast = false) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !noCast;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, noCast = false) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, noCast);
  /** Run `build` and return every object it added to the scene. */
  function collect(build: () => void): THREE.Object3D[] {
    const n0 = scene.children.length;
    build();
    return scene.children.slice(n0);
  }

  /* ---------- room shell ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
  back.position.set(0, H / 2, -L / 2);
  back.receiveShadow = back.castShadow = true;
  scene.add(back);

  const WIN_W = 1.15;
  const WIN_Y0 = 0.8;
  const WIN_SPRING = 2.375;
  const WIN_Z = [0.95, -1.05];
  function archPath<P extends THREE.Path>(P: P, cx: number): P {
    P.moveTo(cx - WIN_W / 2, WIN_Y0);
    P.lineTo(cx + WIN_W / 2, WIN_Y0);
    P.lineTo(cx + WIN_W / 2, WIN_SPRING);
    P.absarc(cx, WIN_SPRING, WIN_W / 2, 0, Math.PI, false);
    P.lineTo(cx - WIN_W / 2, WIN_Y0);
    return P;
  }
  function wall(points: [number, number][], holes: THREE.Path[] = [], segments = 12) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) s.lineTo(x, y);
    s.holes = holes;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, segments), wallMat);
    m.receiveShadow = m.castShadow = true;
    scene.add(m);
    return m;
  }
  const left = wall(
    [[-L / 2, 0], [L / 2, 0], [L / 2, H], [-L / 2, H], [-L / 2, 0]],
    WIN_Z.map((z) => archPath(new THREE.Path(), -z)),
    24,
  );
  left.rotation.y = Math.PI / 2;
  left.position.set(-W / 2, 0, 0);

  const right = wall([[-L / 2, 0], [0.55, 0], [0.55, 2.58], [1.75, 2.58], [1.75, 0], [L / 2, 0], [L / 2, H], [-L / 2, H], [-L / 2, 0]]);
  right.rotation.y = -Math.PI / 2;
  right.position.set(W / 2, 0, 0);

  const front = wall([[-W / 2, 0], [-1.35, 0], [-1.35, 2.58], [-0.45, 2.58], [-0.45, 0], [W / 2, 0], [W / 2, H], [-W / 2, H], [-W / 2, 0]]);
  front.rotation.y = Math.PI;
  front.position.set(0, 0, L / 2);

  /* invisible ceiling that still casts shadows */
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.2, L + 0.2),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, 0);
  ceil.castShadow = true;
  scene.add(ceil);

  /* ---------- the rest of the apartment: hall, living room and end room (structure only) ---------- */
  const apartment = buildApartment({
    trim: trimMat,
    glass: glassMat,
    floor: () => new THREE.MeshStandardMaterial({ roughness: 0.42 }),
  });
  /* every room has the bedroom's floor; each gets the parquet sized to its own outline */
  for (const r of Object.values(apartment.rooms)) r.floor.material.map = floorTexture(FLOOR.hex, r.width, r.depth);
  const pickRooms = [{ id: 'bedroom' as const, poly: BEDROOM_POLY }, ...ROOMS];
  const furniture = loadFurniture(scene, (piece) =>
    piece.file
      ? new GLTFLoader().loadAsync(import.meta.env.BASE_URL + piece.file).then((g) => g.scene)
      : Promise.resolve(quebecRug()),
  );
  const roomLights = addRoomLights(scene);
  scene.add(apartment.group);
  for (const l of apartment.windowLights) scene.add(l, l.target);

  /* skirting */
  box(W - 0.58, 0.18, 0.02, trimMat, -0.29, 0.09, -L / 2 + 0.01);
  box(0.02, 0.18, L, trimMat, -W / 2 + 0.01, 0.09, 0);
  box(0.02, 0.18, 0.525, trimMat, W / 2 - 0.01, 0.09, 0.2875);
  box(0.02, 0.18, 0.225, trimMat, W / 2 - 0.01, 0.09, 1.8625);

  /* ---------- two arched windows + curtains (left wall) ---------- */
  const windowParts = collect(() => {
    for (const cz of WIN_Z) {
      const r = WIN_W / 2;
      const fx = -W / 2 + 0.035;
      box(0.07, WIN_SPRING - WIN_Y0, 0.1, trimMat, fx, (WIN_SPRING + WIN_Y0) / 2, cz - r - 0.05);
      box(0.07, WIN_SPRING - WIN_Y0, 0.1, trimMat, fx, (WIN_SPRING + WIN_Y0) / 2, cz + r + 0.05);
      box(0.16, 0.04, WIN_W + 0.2, trimMat, -W / 2 + 0.08, WIN_Y0 - 0.02, cz);
      const rs = new THREE.Shape();
      rs.absarc(0, 0, r + 0.1, 0, Math.PI, false);
      rs.lineTo(-r, 0);
      rs.absarc(0, 0, r, Math.PI, 0, true);
      rs.lineTo(r + 0.1, 0);
      const ag = new THREE.ExtrudeGeometry(rs, { depth: 0.07, bevelEnabled: false, curveSegments: 28 });
      ag.rotateY(Math.PI / 2);
      add(ag, trimMat, -W / 2, WIN_SPRING, cz);
      box(0.04, WIN_SPRING + r - WIN_Y0, 0.03, trimMat, -W / 2 + 0.02, (WIN_Y0 + WIN_SPRING + r) / 2, cz);
      box(0.04, 0.03, WIN_W, trimMat, -W / 2 + 0.02, WIN_SPRING, cz);
      const gl = new THREE.Mesh(new THREE.ShapeGeometry(archPath(new THREE.Shape(), -cz), 28), glassMat);
      gl.rotation.y = Math.PI / 2;
      gl.position.set(-W / 2 - 0.03, 0, 0);
      scene.add(gl);
    }
    /* one continuous rod along the window wall, four panels to the floor */
    const rodX = -W / 2 + 0.18;
    const cx = -W / 2 + 0.2;
    const ctop = 3.18;
    const cy0 = 0.02;
    const rod = add(new THREE.CylinderGeometry(0.016, 0.016, 3.86, 14), trimMat, rodX, 3.2, 0);
    rod.rotation.x = Math.PI / 2;
    for (const z of [-1.93, 1.93]) add(new THREE.SphereGeometry(0.03, 14, 10), trimMat, rodX, 3.2, z, true);
    for (const z of [-1.75, 0, 1.75]) box(0.18, 0.025, 0.025, trimMat, -W / 2 + 0.09, 3.2, z, true);
    const wz = WIN_Z.slice().sort((p, q) => p - q);
    const halfW = WIN_W / 2;
    const mid = (wz[0] + halfW + wz[1] - halfW) / 2;
    const ranges: [number, number][] = [
      [-L / 2 + 0.005, wz[0] - halfW],
      [wz[0] + halfW, mid],
      [mid, wz[1] - halfW],
      [wz[1] + halfW, L / 2 - 0.005],
    ];
    for (const [z0, z1] of ranges) {
      const w = z1 - z0;
      const m = new THREE.Mesh(curtainGeo(w, ctop - cy0, Math.max(2, Math.round(w * 8))), curtainMat);
      m.position.set(cx, (ctop + cy0) / 2, (z0 + z1) / 2);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      for (let z = z0 + 0.03; z <= z1 - 0.02; z += 0.055) {
        add(new THREE.TorusGeometry(0.026, 0.004, 6, 16), trimMat, rodX, 3.2, z, true);
      }
    }
  });

  /* ---------- double doors (right wall) ---------- */
  const doorParts = collect(() => {
    for (const z of [0.85, 1.45]) {
      box(0.04, 2.56, 0.59, trimMat, W / 2 - 0.04, 1.28, z);
      box(0.012, 1.2, 0.4, trimMat, W / 2 - 0.07, 1.85, z);
      box(0.012, 0.95, 0.4, trimMat, W / 2 - 0.07, 0.62, z);
    }
    box(0.03, 2.6, 0.07, trimMat, W / 2 - 0.015, 1.3, 0.55 - 0.035);
    box(0.03, 2.6, 0.07, trimMat, W / 2 - 0.015, 1.3, 1.75 + 0.035);
    box(0.03, 0.07, 1.34, trimMat, W / 2 - 0.015, 2.615, 1.15);
    for (const z of [1.08, 1.22]) {
      add(new THREE.SphereGeometry(0.03, 16, 12), brassMat, W / 2 - 0.085, 1.0, z);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10), brassMat, W / 2 - 0.07, 1.0, z).rotation.z = Math.PI / 2;
    }
  });

  /* ---------- bed (IKEA TONSTAD 160x200), bench (ILVA Amigo) and pillows, shifted by BEDX ---------- */
  const bz0 = -L / 2;
  const BF = 0.15;
  const bedParts = collect(() => {
    for (const [x, z] of [[-0.78, bz0 + 0.1], [0.78, bz0 + 0.1], [-0.78, bz0 + 2.0], [0.78, bz0 + 2.0]]) {
      box(0.06, BF, 0.06, oakMat, x, BF / 2, z);
    }
    box(0.045, 0.3, 2.05, oakMat, -0.8225, 0.19 + BF, bz0 + 0.04 + 1.025);
    box(0.045, 0.3, 2.05, oakMat, 0.8225, 0.19 + BF, bz0 + 0.04 + 1.025);
    for (const sx of [-1, 1]) {
      for (const z of [bz0 + 0.04 + 0.5, bz0 + 0.04 + 1.5]) box(0.014, 0.2, 0.95, oakDeepMat, sx * 0.851, 0.15 + BF, z);
    }
    box(1.6, 0.03, 2.0, oakDeepMat, 0, 0.265 + BF, bz0 + 0.04 + 1.0);
    box(1.69, 1.16 + BF - 0.18, 0.04, oakMat, 0, 0.18 + (1.16 + BF - 0.18) / 2, bz0 + 0.02); // headboard above the 18 cm skirting
    box(1.69, 0.46, 0.03, oakMat, 0, 0.23 + BF, bz0 + 2.09 - 0.015);
    box(1.6, 0.2, 2.0, mattressMat, 0, 0.38 + BF, bz0 + 0.04 + 1.0);
    box(1.64, 0.07, 1.35, beddingMat, 0, 0.515 + BF, -0.625);
    box(0.04, 0.22, 1.35, beddingMat, -0.82, 0.4 + BF, -0.625);
    box(0.04, 0.22, 1.35, beddingMat, 0.82, 0.4 + BF, -0.625);
    box(1.66, 0.085, 0.38, throwMat, 0, 0.52 + BF, -0.26);
    box(1.66, 0.2, 0.012, throwMat, 0, 0.41 + BF, -0.07);

    /* bench: 90 x 35 x 45 cm, solid oak, woven seat, low shelf */
    const weaveMat = new THREE.MeshStandardMaterial({ map: weaveTexture(), roughness: 0.9 });
    const bzc = bz0 + 2.09 + 0.02 + 0.175;
    const BW = 0.9;
    const BD = 0.35;
    const BH = 0.45;
    for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(new THREE.CylinderGeometry(0.021, 0.019, BH, 14), oakMat, qx * (BW / 2 - 0.03), BH / 2, bzc + qz * (BD / 2 - 0.03));
    }
    for (const sz of [-1, 1]) box(BW - 0.04, 0.06, 0.025, oakMat, 0, BH - 0.05, bzc + sz * (BD / 2 - 0.03));
    for (const sx of [-1, 1]) box(0.025, 0.06, BD - 0.04, oakMat, sx * (BW / 2 - 0.03), BH - 0.05, bzc);
    box(BW - 0.09, 0.022, BD - 0.09, weaveMat, 0, BH - 0.045, bzc);
    for (const k of [-1, 0, 1]) box(BW - 0.07, 0.022, 0.07, oakMat, 0, 0.17, bzc + k * 0.09);

    const pillows: [number, number, number, number, number, number, number][] = [
      // w, h, d, x, y, z, tilt
      [0.62, 0.16, 0.62, -0.4, 0.75, -1.6, -0.45],
      [0.62, 0.16, 0.62, 0.4, 0.75, -1.6, -0.45],
      [0.72, 0.13, 0.48, -0.4, 0.73, -1.3, -0.2],
      [0.72, 0.13, 0.48, 0.4, 0.73, -1.3, -0.2],
      [0.5, 0.1, 0.22, 0, 0.78, -1.1, -0.1],
    ];
    pillows.forEach(([w, h, d, x, y, z, tilt], i) => {
      add(pillowGeo(w, h, d), pillowMats[i], x, y, z).rotation.x = tilt;
    });
  });
  for (const m of bedParts) m.position.x += BEDX;

  /* ---------- front wall door, left of the dresser ---------- */
  const frontParts = collect(() => {
    box(0.86, 2.56, 0.04, trimMat, 0.9, 1.28, L / 2 - 0.04);
    box(0.07, 2.6, 0.03, trimMat, 0.9 - 0.485, 1.3, L / 2 - 0.015);
    box(0.07, 2.6, 0.03, trimMat, 0.9 + 0.485, 1.3, L / 2 - 0.015);
    box(1.04, 0.07, 0.03, trimMat, 0.9, 2.615, L / 2 - 0.015);
    add(new THREE.SphereGeometry(0.03, 16, 12), brassMat, 0.6, 1.0, L / 2 - 0.085);
    box(2.6, 0.18, 0.02, trimMat, -0.85, 0.09, L / 2 - 0.01);
    box(0.8, 0.18, 0.02, trimMat, 1.75, 0.09, L / 2 - 0.01);
  });

  /* ---------- dresser: Mio TOVA 80 x 42 x 100 cm (front-left corner) ---------- */
  const dcx = -W / 2 + 0.8;
  const dcz = L / 2 - 0.22;
  const dfz = dcz - 0.21;
  const slotMat = std('#3A2D20', 1);
  for (const [qx, qz] of [[-0.35, -0.15], [0.35, -0.15], [-0.35, 0.15], [0.35, 0.15]]) box(0.04, 0.2, 0.04, oakMat, dcx + qx, 0.1, dcz + qz);
  box(0.8, 0.77, 0.42, oakDeepMat, dcx, 0.585, dcz);
  box(0.82, 0.03, 0.44, oakMat, dcx, 0.985, dcz);
  for (let di = 0; di < 5; di++) {
    const dy = 0.283 + di * 0.153;
    box(0.76, 0.142, 0.02, oakMat, dcx, dy, dfz - 0.005);
    box(0.26, 0.012, 0.006, slotMat, dcx, dy + 0.045, dfz - 0.018, true);
  }
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 20), brassMat, dcx - 0.2, 1.11, dcz);
  shadeMat.side = THREE.DoubleSide;
  add(new THREE.CylinderGeometry(0.11, 0.16, 0.2, 24, 1, true), shadeMat, dcx - 0.2, 1.32, dcz);
  add(new THREE.CylinderGeometry(0.055, 0.07, 0.24, 20), vaseMat, dcx + 0.22, 1.12, dcz);
  box(0.12, 0.03, 0.18, trimMat, dcx + 0.02, 1.015, dcz);

  /* ---------- full-length mirror, wall-mounted, left of the dresser ---------- */
  const mirror = new THREE.Group();
  const mf = new THREE.Mesh(new THREE.BoxGeometry(0.59, 1.74, 0.03), oakMat);
  mf.castShadow = mf.receiveShadow = true;
  const mg = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.7), mirrorMat);
  mg.rotation.y = Math.PI;
  mg.position.z = -0.0166;
  mirror.add(mf, mg);
  mirror.position.set(-0.2675, 1.15, L / 2 - 0.02);
  scene.add(mirror);

  /* ---------- wall-hung bedside tables (AC Design Cholet) + Mio Adina wall lamps ---------- */
  const tableX = [BEDX - 1.32, BEDX + 1.32];
  const lampBrass = std(BRASS, 0.55, 0.5); // brushed: rougher and duller than the polished brass handles
  const lampCord = std('#1F1F1D', 0.7, 0);
  const lampShadeMat = std('#DCCDAE', 0.95);
  lampShadeMat.side = THREE.DoubleSide;
  const lampBulb = new THREE.MeshBasicMaterial({ color: 0xffe6b8 });
  const tableParts = tableX.map((x) =>
    collect(() => {
      const zc = -L / 2 + 0.175;
      /* 24 cm tall, centred inside the lower panel's frame so it sits clear of the rail and the frame strips */
      const TOP = (LOW_Y0 + LOW_Y1) / 2 + 0.12;
      box(0.5, 0.02, 0.35, oakMat, x, TOP - 0.01, zc);
      box(0.5, 0.02, 0.35, oakMat, x, TOP - 0.24, zc);
      for (const o of [-0.24, 0.24]) box(0.02, 0.21, 0.35, oakMat, x + o, TOP - 0.125, zc);
      box(0.46, 0.21, 0.01, oakDeepMat, x, TOP - 0.125, -L / 2 + 0.005);
      box(0.46, 0.07, 0.02, oakMat, x, TOP - 0.055, zc + 0.165);
      box(0.46, 0.015, 0.32, oakMat, x, TOP - 0.0975, zc);
      add(new THREE.SphereGeometry(0.012, 12, 10), brassMat, x, TOP - 0.055, zc + 0.185);
      /* Mio Adina, H26 × B18 cm, in brushed brass: round wall disc, a short arm out to a vertical stem, a tapered
         textile shade on top of the stem, and a black cord with an inline switch down to the table */
      const wz = -L / 2;
      const sz = wz + ADINA_STEM_OUT;
      const shadeY0 = ADINA_SHADE_Y - 0.06;
      const lampY0 = shadeY0 + 0.12 - 0.26; // bottom of the stem: 26 cm below the top of the shade
      const armY = shadeY0 + 0.12 - 0.173;
      const disc = add(new THREE.CylinderGeometry(0.055, 0.055, 0.022, 40), lampBrass, x, armY, wz + 0.011);
      disc.rotation.x = Math.PI / 2;
      const arm = add(new THREE.CylinderGeometry(0.005, 0.005, ADINA_STEM_OUT - 0.022, 10), lampBrass, x, armY, wz + (0.022 + ADINA_STEM_OUT) / 2);
      arm.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.006, 0.006, shadeY0 - lampY0, 12), lampBrass, x, (shadeY0 + lampY0) / 2, sz);
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.026, 16), lampBrass, x, shadeY0 + 0.013, sz, true); // bulb socket
      add(new THREE.CylinderGeometry(0.058, 0.09, 0.12, 40, 1, true), lampShadeMat, x, ADINA_SHADE_Y, sz);
      add(new THREE.SphereGeometry(0.02, 12, 10), lampBulb, x, shadeY0 + 0.045, sz, true);
      /* cord from the bottom of the disc down the wall to the table top, with the inline switch */
      const cordX = x + 0.012;
      const cordTop = armY - 0.05;
      add(new THREE.CylinderGeometry(0.0025, 0.0025, cordTop - TOP, 6), lampCord, cordX, (cordTop + TOP) / 2, wz + 0.004, true);
      box(0.022, 0.06, 0.016, lampCord, cordX, cordTop - 0.22, wz + 0.01, true);
    }),
  );

  /* ---------- IKEA GULLSUDARE 70 cm rice-paper pendant, centre of the room ---------- */
  const pendantY = 2.35;
  const paperMat = new THREE.MeshStandardMaterial({ color: lin('#F4F1E8'), roughness: 1, side: THREE.DoubleSide });
  const pendantParts = collect(() => {
    const pg = new THREE.SphereGeometry(0.35, 56, 36);
    const pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const px = pp.getX(i);
      const py = pp.getY(i);
      const pz = pp.getZ(i);
      const rr = Math.hypot(px, pz);
      if (rr > 0.001) {
        const k = 1 + 0.012 * Math.sin(Math.atan2(pz, px) * 28) * Math.min(1, rr / 0.35);
        pp.setXYZ(i, px * k, py, pz * k);
      }
    }
    pg.computeVertexNormals();
    add(pg, paperMat, 0, pendantY, 0, true);
    add(new THREE.CylinderGeometry(0.004, 0.004, H - (pendantY + 0.35), 6), std('#EDEBE4', 0.8), 0, (H + pendantY + 0.35) / 2, 0, true);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), trimMat, 0, H - 0.015, 0, true);
    add(new THREE.SphereGeometry(0.05, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe6b8 }), 0, pendantY, 0, true);
  });
  const pendantLight = new THREE.PointLight(0xffc890, 0, 9, 1.3);
  pendantLight.position.set(0, pendantY, 0);
  pendantLight.shadow.mapSize.set(256, 256);
  pendantLight.shadow.radius = 16;
  pendantLight.shadow.camera.near = 0.05;
  pendantLight.shadow.camera.far = 9;
  pendantLight.shadow.bias = -0.002;
  scene.add(pendantLight);

  /* ---------- two built-in Pax wardrobes (right wall) ---------- */
  for (const [z0, z1] of [[-L / 2, -L / 2 + 1], [-L / 2 + 1, -L / 2 + 2]]) {
    const zc = (z0 + z1) / 2;
    box(0.58, 3.0, 1.0, wardMat, W / 2 - 0.29, 1.5, zc);
    for (const i of [0, 1]) {
      const zd = z0 + 0.01 + i * 0.495;
      box(0.02, 2.36, 0.485, wardMat, W / 2 - 0.58, 1.25, zd + 0.2425);
      box(0.02, 0.5, 0.485, wardMat, W / 2 - 0.58, 2.72, zd + 0.2425);
    }
    for (const o of [-0.04, 0.04]) {
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 10), brassMat, W / 2 - 0.6, 1.05, zc + o);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 10), brassMat, W / 2 - 0.6, 2.6, zc + o);
    }
  }

  /* ---------- painting above the dresser ---------- */
  const paintParts = collect(() => {
    const py = 1.95;
    box(0.9, 0.64, 0.04, frameMat, dcx, py, L / 2 - 0.02);
    box(0.78, 0.52, 0.01, matMat, dcx, py, L / 2 - 0.045, true);
    box(0.66, 0.418, 0.008, artMat, dcx, py, L / 2 - 0.052, true);
  });

  /* ---------- rug ---------- */
  const rugMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const rugMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.018, 1), [rugSide, rugSide, rugMat, rugSide, rugSide, rugSide]);
  rugMesh.receiveShadow = true;
  rugMesh.rotation.y = Math.PI / 2;
  rugMesh.scale.set(RUG_SIZE.w, 1, RUG_SIZE.l);
  rugMesh.position.set(BEDX, 0.011, -L / 2 + 0.5 + RUG_SIZE.w / 2); // edge = bench front + 4 cm
  scene.add(rugMesh);
  const rugTextures = new Map<string, THREE.CanvasTexture>();
  const rugTexture = (id: string) => {
    let t = rugTextures.get(id);
    const c = getRugCanvases()[id];
    if (!t && c) rugTextures.set(id, (t = canvasTexture(c)));
    return t ?? null;
  };

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8a98c, 0.45);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 0.9);
  sun.position.set(-7, 5, -0.8);
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.radius = 1;
  /* the sun's shadow box has to cover the whole apartment (every room's ceiling and walls block it),
     otherwise anything outside the box is treated as sunlit. Fit it to the apartment as the sun sees it. */
  {
    const b = apartmentBounds();
    const view = new THREE.Matrix4().lookAt(sun.position, sun.target.position, new THREE.Vector3(0, 1, 0));
    view.setPosition(sun.position).invert();
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
    const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const x of [b.minX, b.maxX]) for (const y of [0, CEILING]) for (const z of [b.minZ, b.maxZ]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(view);
      lo.min(p);
      hi.max(p);
    }
    const m = 0.5;
    Object.assign(sun.shadow.camera, { left: lo.x - m, right: hi.x + m, bottom: lo.y - m, top: hi.y + m, near: 0.5, far: -lo.z + m });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.mapSize.set(2048, 2048);
  }
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  /* daylight spilling in through each window: soft, shadow-casting and falling off across the room,
     so the window side reads bright and the far wall, corners and undersides of furniture go dim */
  const windowLights = WIN_Z.map((cz) => {
    const l = new THREE.SpotLight(0xeef3ff, 0, 7.5, 1.15, 1, 1.6);
    l.position.set(-W / 2 + 0.32, 2.15, cz);
    l.target.position.set(0.9, 0.2, cz * 0.6);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.radius = 1;
    l.shadow.camera.near = 0.1;
    l.shadow.camera.far = 8;
    l.shadow.bias = -0.0008;
    l.shadow.normalBias = 0.02;
    scene.add(l, l.target);
    return l;
  });
  /* evening lamps: the bulb sits inside its shade and the shade casts (heavily blurred) shadows, so each
     lamp throws a pool of light down and a cone up the wall. A second, shadowless glow light stands in
     for the light a fabric or paper shade lets through, so the cone edges fade instead of cutting to dark.
     Long reach and gentle decay let each lamp's light blend into the next instead of forming its own pool. */
  const bulb = (x: number, y: number, z: number, distance: number) => {
    const key = new THREE.PointLight(0xffb978, 0, distance, 1.3);
    key.position.set(x, y, z);
    key.shadow.mapSize.set(256, 256);
    key.shadow.radius = 16;
    key.shadow.camera.near = 0.02;
    key.shadow.camera.far = distance;
    key.shadow.bias = -0.003;
    const glow = new THREE.PointLight(0xffc48a, 0, distance, 1.3);
    glow.position.set(x, y, z);
    scene.add(key, glow);
    return { key, glow };
  };
  const lamp = bulb(dcx - 0.2, 1.3, dcz, 8);
  const wallLamps = tableX.map((x) => bulb(x, ADINA_SHADE_Y - 0.015, -L / 2 + ADINA_STEM_OUT, 7));
  const daylightCasters: THREE.Light[] = [sun, ...windowLights];

  /* ---------- wall moulding, bed wall: rail at 75 cm, three columns, big panels above, small below ---------- */
  let mouldParts: THREE.Mesh[] = [];
  let lastLayout = '';
  function mstrip(w: number, h: number, x: number, y: number, d = 0.014) {
    mouldParts.push(box(w, h, d, mouldMat, x, y, -L / 2 + d / 2, true));
  }
  function frameOf(strip: (w: number, h: number, x: number, y: number) => void, x0: number, x1: number, y0: number, y1: number) {
    const t = FRAME_T;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    strip(x1 - x0, t, cx, y0 + t / 2);
    strip(x1 - x0, t, cx, y1 - t / 2);
    strip(t, y1 - y0 - 2 * t, x0 + t / 2, cy);
    strip(t, y1 - y0 - 2 * t, x1 - t / 2, cy);
  }
  function layoutBedWall(s: Settings) {
    const layout = bedWallLayout(s.mcen, s.mgap, s.msw);
    const key = `${layout.centreHalf}|${layout.gap}|${layout.sideWidth}`;
    if (key === lastLayout) return;
    lastLayout = key;
    for (const m of mouldParts) {
      scene.remove(m);
      m.geometry.dispose();
    }
    mouldParts = [];
    mstrip(W, 0.04, 0, RAIL_Y, 0.02);
    for (const [x0, x1] of layout.columns) {
      frameOf(mstrip, BEDX + x0, BEDX + x1, LOW_Y0, LOW_Y1);
      frameOf(mstrip, BEDX + x0, BEDX + x1, RAIL_Y + 0.08, 3.0);
    }
    /* the wall-hung tables and lamps ride with the side columns */
    [BEDX - layout.tableOffset, BEDX + layout.tableOffset].forEach((nx, i) => {
      const dx = nx - tableX[i];
      tableX[i] = nx;
      for (const m of tableParts[i]) m.position.x += dx;
      wallLamps[i].key.position.x = nx;
      wallLamps[i].glow.position.x = nx;
    });
  }

  /* ---------- wall moulding, dresser wall: frames in the free wall sections ---------- */
  const mouldFParts = collect(() => {
    const fstrip = (w: number, h: number, x: number, y: number, d = 0.009) => box(w, h, d, mouldFMat, x, y, L / 2 - d / 2, true);
    const MIRX = -0.2675;
    const MIRH = 0.295;
    const DOOR0 = 0.415;
    const DOOR1 = 1.385;
    for (const [r0, r1] of [[-W / 2, -1.75], [-0.95, MIRX - MIRH], [MIRX + MIRH, DOOR0], [DOOR1, W / 2]]) {
      if (r1 > r0) fstrip(r1 - r0, 0.04, (r0 + r1) / 2, RAIL_Y, 0.012);
    }
    for (const [c0, c1] of [[-1.9, -0.8], [1.485, 2.05]]) {
      frameOf(fstrip, c0, c1, LOW_Y0, LOW_Y1);
      frameOf(fstrip, c0, c1, RAIL_Y + 0.08, 3.0);
    }
  });

  /* ---------- apply settings ---------- */
  let artKey = '';
  function apply(s: Settings) {
    current = s;
    const wallHex = findById(PAINTS, s.walls.bedroom).hex;
    wallMat.color.copy(lin(wallHex));
    const mouldHex = s.mould === 'tone' ? wallHex : TRIM.hex;
    for (const m of [mouldMat, mouldFMat]) {
      m.color.copy(lin(mouldHex));
      if (s.mould === 'tone') m.color.multiplyScalar(0.82);
    }
    layoutBedWall(s);
    wardMat.color.copy(lin(s.ward === 'trim' ? TRIM.hex : s.ward === 'ink' ? INK : wallHex));
    for (const [id, r] of Object.entries(apartment.rooms) as [Exclude<RoomId, 'bedroom'>, (typeof apartment.rooms)['hall']][]) {
      r.wall.color.copy(lin(findById(PAINTS, s.walls[id]).hex));
    }
    furniture.setHidden(s.hidden);

    vaseMat.color.copy(lin(s.accent));
    const pl = pillowColours(s.pillows, s.accent);
    [pl.euro[0], pl.euro[1], pl.std[0], pl.std[1], pl.lumbar].forEach((hex, i) => pillowMats[i].color.copy(lin(hex)));
    throwMat.color.copy(lin(pl.throw));

    if (artKey !== `${s.art}|${s.accent}`) {
      artKey = `${s.art}|${s.accent}`;
      artMat.map?.dispose();
      artMat.map = artTexture(s.art, s.accent);
      artMat.needsUpdate = true;
    }
    const fr = findById(FRAMES, s.frame);
    frameMat.color.copy(lin(fr.hex));
    frameMat.metalness = s.frame === 'brass' ? 0.4 : 0;
    frameMat.roughness = s.frame === 'brass' ? 0.4 : 0.7;

    const tex = s.rug === 'none' ? null : rugTexture(s.rug);
    rugMesh.visible = !!tex;
    if (tex) {
      rugMat.map = tex;
      rugMat.needsUpdate = true;
      rugSide.color.copy(lin(findById(RUGS, s.rug).edge));
    }

    const eve = s.time === 'eve';
    roomLights.setEvening(eve);
    /* daylight: a strong low sun through the windows does most of the work, with a dim sky fill so
       corners, the far side of furniture and the floor under the bed fall into real shade */
    sun.intensity = eve ? 0 : 1.6;
    /* evening: the window lights become faint, cool moonlight */
    for (const l of [...windowLights, ...apartment.windowLights]) {
      l.intensity = eve ? 0.18 : 1.6;
      l.color.set(eve ? 0x8ea6d6 : 0xeef3ff);
    }
    /* evening: warm bounce light off the lamp-lit walls and ceiling fills in what faces away from the lamps */
    hemi.intensity = eve ? 0.3 : 0.26;
    hemi.color.set(eve ? 0xa68a6c : 0xdfe8f2);
    hemi.groundColor.set(eve ? 0x5c4836 : 0xb8a98c);
    const pon = s.pendant === 'on';
    lamp.key.intensity = eve ? 0.55 : 0;
    lamp.glow.intensity = eve ? 0.5 : 0;
    for (const l of wallLamps) {
      l.key.intensity = eve ? 0.35 : 0;
      l.glow.intensity = eve ? 0.35 : 0;
    }
    for (const m of pendantParts) m.visible = pon;
    pendantLight.intensity = eve && pon ? 0.7 : 0;
    /* only the lights that are actually on render shadow maps (point-light shadows cost six passes each) */
    for (const l of daylightCasters) l.castShadow = !eve;
    lamp.key.castShadow = eve;
    for (const l of wallLamps) l.key.castShadow = eve;
    pendantLight.castShadow = eve && pon;
    paperMat.emissive.set(eve ? 0xffc27a : 0x000000);
    paperMat.emissiveIntensity = eve ? 0.7 : 0;
    for (const m of [lampShadeMat, shadeMat]) {
      m.emissive.set(eve ? 0xffb35e : 0x000000);
      m.emissiveIntensity = eve ? 0.9 : 0;
    }
    glassMat.color.set(eve ? 0x1b2634 : 0xdce8ee);
    mirrorMat.color.setScalar(eve ? 0.35 : 1);
  }

  /* ---------- orbit camera ---------- */
  const cur: CameraPose = { ...VIEWS[0].pose };
  const goal: CameraPose = { ...VIEWS[0].pose };
  const pts = new Map<number, { x: number; y: number }>();
  let lastPinch = 0;
  const pinchDistance = () => {
    const [a, b] = Array.from(pts.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  /* where the current press started and how many pointers it has used, to tell a click from an orbit or pinch */
  let pressAt = { x: 0, y: 0 };
  let pressTravel = 0;
  let pressPointers = 0;
  const travel = (e: PointerEvent) => {
    pressTravel = Math.max(pressTravel, Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y));
  };
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    if (pts.size === 0) {
      pressAt = { x: e.clientX, y: e.clientY };
      pressTravel = 0;
      pressPointers = 0;
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pressPointers = Math.max(pressPointers, pts.size);
    if (pts.size === 2) lastPinch = pinchDistance();
  };
  const onMove = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    travel(e);
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pts.size === 1) {
      goal.theta -= dx * 0.006;
      goal.phi = clamp(goal.phi - dy * 0.005, 0.15, 1.5);
    } else if (pts.size === 2) {
      const d = pinchDistance();
      if (lastPinch > 0) goal.dist = clamp((goal.dist * lastPinch) / d, 3, 32);
      lastPinch = d;
    }
  };
  const onUp = (e: PointerEvent) => {
    const last = pts.size === 1 && pts.has(e.pointerId);
    pts.delete(e.pointerId);
    if (last) travel(e);
    if (last && e.type === 'pointerup' && onPick && isClick(pressTravel, pressPointers)) {
      const r = canvas.getBoundingClientRect();
      const ndc = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
      onPick(pickRoom(ndc, camera, scene.children, pickRooms));
    }
    lastPinch = 0;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0012), 3, 32);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function fit() {
    const r = container.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(container);
  window.addEventListener('resize', fit);
  fit();

  const setVisible = (parts: THREE.Object3D[], v: boolean) => {
    for (const m of parts) m.visible = v;
  };
  let raf = 0;
  function frame() {
    for (const key of Object.keys(cur) as (keyof CameraPose)[]) cur[key] += (goal[key] - cur[key]) * 0.14;
    const d = cur.dist * Math.max(1, 1.15 / camera.aspect);
    camera.position.set(
      cur.tx + d * Math.sin(cur.phi) * Math.sin(cur.theta),
      cur.ty + d * Math.cos(cur.phi),
      cur.tz + d * Math.sin(cur.phi) * Math.cos(cur.theta),
    );
    camera.lookAt(cur.tx, cur.ty, cur.tz);
    /* hide whatever sits on a wall the camera is looking through */
    const wv = camera.position.x > -W / 2 - 0.05;
    const dv = camera.position.x < W / 2 + 0.05;
    const fv = camera.position.z < L / 2 + 0.05;
    const bv = camera.position.z > -L / 2 - 0.05;
    setVisible(windowParts, wv);
    setVisible(doorParts, dv);
    setVisible(frontParts, fv);
    setVisible(paintParts, fv);
    mirror.visible = fv;
    setVisible(mouldParts, bv && current.mouldB !== 'off');
    setVisible(mouldFParts, fv && current.mouldF !== 'off');
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  apply(initial);
  frame();

  return {
    apply,
    setView(pose) {
      Object.assign(goal, pose);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      const materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
        }
      });
      for (const m of materials) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
        m.dispose();
      }
      for (const t of rugTextures.values()) t.dispose();
      renderer.dispose();
    },
  };
}

/* ---------- geometry helpers ---------- */
function curtainGeo(w: number, h: number, pleats: number) {
  const g = new THREE.PlaneGeometry(w, h, 30, 56);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const u = x / w + 0.5;
    p.setZ(i, 0.028 * Math.sin(u * Math.PI * 2 * pleats) + 0.005 * Math.sin(y * 3 + u * 5));
  }
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function pillowGeo(w: number, h: number, d: number) {
  const g = new THREE.SphereGeometry(0.5, 28, 18);
  const p = g.attributes.position;
  const shape = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * 2;
    const y = p.getY(i) * 2;
    const z = p.getZ(i) * 2;
    p.setXYZ(i, (shape(x, 0.55) * w) / 2, (shape(y, 0.75) * h) / 2, (shape(z, 0.55) * d) / 2);
  }
  g.computeVertexNormals();
  return g;
}
