import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FLOOR, PAINTS, VIEWS, findById, type CameraPose } from '../data/catalog';
import { ROOMS, type RoomId } from '../data/rooms';
import type { Settings } from '../state/settings';
import { buildBedroom } from './bedroom';
import { SHELL_ROOMS, buildApartment } from './buildApartment';
import { addSkyAndSun, setWindowSpot } from './daylight';
import { disposeTree } from './dispose';
import { loadFurniture } from './furniture';
import { lin } from './materials';
import { orbitCamera } from './orbitCamera';
import { pickRoom } from './pickRoom';
import { quebecRug } from './quebecRug';
import { addRoomLights } from './roomLights';
import { floorTexture } from './textures';

export interface ApartmentScene {
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

/**
 * The 3D apartment in `canvas`, sized to `container`: the hand-built bedroom, the other rooms built from their
 * outlines, the living-room furniture, daylight and evening lighting, and an orbit camera.
 */
export function createApartmentScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  initial: Settings,
  /** called with the room under a click (not a drag), or null for a click outside the apartment */
  onPick?: (room: RoomId | null) => void,
): ApartmentScene {
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

  const bedroom = buildBedroom(scene, initial.accent);

  /* the rest of the apartment: hall, living room and office (structure only), with the bedroom's trim and glass */
  const apartment = buildApartment({
    trim: bedroom.shared.trim,
    glass: bedroom.shared.glass,
    floor: () => new THREE.MeshStandardMaterial({ roughness: 0.42 }),
  });
  /* every room has the bedroom's floor; each gets the parquet sized to its own outline */
  for (const r of Object.values(apartment.rooms)) r.floor.material.map = floorTexture(FLOOR.hex, r.width, r.depth);
  scene.add(apartment.group);
  for (const l of apartment.windowLights) scene.add(l, l.target);

  const furniture = loadFurniture(scene, (piece) =>
    piece.file
      ? new GLTFLoader().loadAsync(import.meta.env.BASE_URL + piece.file).then((g) => g.scene)
      : Promise.resolve(quebecRug()),
  );
  let furnitureReady = false;
  void furniture.ready.then(() => (furnitureReady = true));

  const roomLights = addRoomLights(scene);
  const sky = addSkyAndSun(scene);

  function apply(s: Settings) {
    const evening = s.time === 'eve';
    bedroom.apply(s);
    for (const r of SHELL_ROOMS) apartment.rooms[r.id].wall.color.copy(lin(findById(PAINTS, s.walls[r.id]).hex));
    furniture.setHidden(s.hidden);
    sky.setEvening(evening);
    for (const l of [...bedroom.windowLights, ...apartment.windowLights]) setWindowSpot(l, evening);
    roomLights.setEvening(evening);
  }

  const orbit = orbitCamera(canvas, camera, VIEWS[0].pose, (ndc) => onPick?.(pickRoom(ndc, camera, scene.children, ROOMS)));

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

  let raf = 0;
  function frame() {
    const arrived = orbit.update();
    bedroom.showFrom(camera.position);
    renderer.render(scene, camera);
    /* lets screenshot tests wait for a still frame: the camera has arrived and the furniture has loaded */
    const settled = String(arrived && furnitureReady);
    if (canvas.dataset.settled !== settled) canvas.dataset.settled = settled;
    raf = requestAnimationFrame(frame);
  }

  apply(initial);
  frame();

  return {
    apply,
    setView(pose) {
      orbit.setView(pose);
      canvas.dataset.settled = 'false';
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      orbit.dispose();
      furniture.dispose();
      disposeTree(scene);
      bedroom.dispose();
      renderer.dispose();
    },
  };
}
