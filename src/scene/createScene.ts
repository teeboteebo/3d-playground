import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FLOOR, PAINTS, VIEWS, findById, type CameraPose } from '../data/catalog';
import { ROOMS, type RoomId } from '../data/rooms';
import type { Settings } from '../state/settings';
import { buildBedroom } from './bedroom';
import { buildApartment } from './buildApartment';
import { addSkyAndSun, setWindowSpot } from './daylight';
import { disposeTree } from './dispose';
import { loadFurniture } from './furniture';
import { applyLegacyLook } from './legacyLook';
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
  applyLegacyLook();
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    throw new WebGLUnavailableError(e);
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  /* PCF filters over each light's shadow.radius (as r128 did, see legacyLook), so shadow edges come out soft */
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);

  const bedroom = buildBedroom(scene, initial.bedroom.accent);

  /* every room's walls, floor and ceiling, and the other rooms' doors and windows, in the bedroom's trim and glass */
  const apartment = buildApartment({
    trim: bedroom.shared.trim,
    glass: bedroom.shared.glass,
    floor: () => new THREE.MeshStandardMaterial({ roughness: 0.42 }),
  });
  /* every room has the bedroom's floor; each gets the parquet sized to its own outline */
  for (const r of Object.values(apartment.rooms)) r.floor.material.map = floorTexture(FLOOR.hex, r.width, r.depth);
  scene.add(apartment.group);
  for (const l of apartment.windowLights) scene.add(l, l.target);

  /* the scene is drawn only when something changes: a setting, the camera, the canvas size or a piece loading */
  let dirty = true;
  const invalidate = () => {
    dirty = true;
  };

  /* the models are meshopt-compressed (see README) */
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const furniture = loadFurniture(
    scene,
    (piece) => (piece.file ? gltf.loadAsync(import.meta.env.BASE_URL + piece.file).then((g) => g.scene) : Promise.resolve(quebecRug())),
    invalidate,
  );
  let furnitureReady = false;
  void furniture.ready.then(() => (furnitureReady = true));

  const roomLights = addRoomLights(scene);
  const sky = addSkyAndSun(scene);

  function apply(s: Settings) {
    invalidate();
    const evening = s.time === 'eve';
    bedroom.apply(s);
    for (const r of ROOMS) apartment.rooms[r.id].wall.color.copy(lin(findById(PAINTS, s.walls[r.id]).hex));
    furniture.setHidden(s.living.hidden);
    sky.setEvening(evening);
    for (const l of [...bedroom.windowLights, ...apartment.windowLights]) setWindowSpot(l, evening);
    roomLights.setEvening(evening);
  }

  const orbit = orbitCamera(canvas, camera, VIEWS[0].pose, (ndc) => onPick?.(pickRoom(ndc, camera, scene.children, ROOMS)));

  /* the pending animation frame; 0 until the first frame */
  let raf = 0;
  function fit() {
    const r = container.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    /* resizing clears the canvas, so draw again now rather than show a blank frame, and once more next frame,
       when the camera has stepped back or in for the new shape */
    if (raf) draw();
    invalidate();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(container);
  window.addEventListener('resize', fit);
  fit();

  function draw() {
    bedroom.showFrom(camera.position);
    apartment.showFrom(camera.position);
    renderer.render(scene, camera);
    dirty = false;
  }
  /* a restored WebGL context starts blank */
  canvas.addEventListener('webglcontextrestored', invalidate);
  function frame() {
    const { moved, arrived } = orbit.update();
    if (moved || dirty) draw();
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
      canvas.removeEventListener('webglcontextrestored', invalidate);
      orbit.dispose();
      furniture.dispose();
      disposeTree(scene);
      bedroom.dispose();
      renderer.dispose();
    },
  };
}
