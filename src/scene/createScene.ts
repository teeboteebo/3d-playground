import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FLOOR, PAINTS, VIEWS, findById, type CameraPose } from '../data/catalog';
import { ROOMS, type RoomSelection } from '../data/rooms';
import type { Settings } from '../state/settings';
import { buildBedroom } from './bedroom';
import { buildApartment } from './buildApartment';
import { buildLivingMoulding } from './livingMoulding';
import { addSkyAndSun, setWindowSpot } from './daylight';
import { disposeTree } from './dispose';
import { loadFurniture } from './furniture';
import { applyLegacyLook } from './legacyLook';
import { lin } from './materials';
import { buildOffice } from './office';
import { orbitCamera } from './orbitCamera';
import { highlighter } from './highlight';
import { pick, type Pick } from './pickRoom';
import type { SceneOption } from './options';
import { renderPipeline } from './pipeline';
import { quebecRug } from './quebecRug';
import { addRoomLamps } from './roomLamps';
import { addRoomLights } from './roomLights';
import { sofaFabric } from './sofaFabric';
import { floorTexture } from './textures';
import { tagOption } from './options';

export interface ApartmentScene {
  apply(settings: Settings): void;
  /** ease the camera to a pose; fields left out (e.g. the rotation) stay as they are */
  setView(pose: Partial<CameraPose>): void;
  dispose(): void;
}

/** a menu option under the mouse, and where the mouse is in the container (px) */
export interface Hover {
  option: SceneOption;
  x: number;
  y: number;
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
  /** called with what a click (not a drag) lands on: its room (null outside the apartment) and menu option */
  onPick?: (pick: Pick) => void,
  /** called as the mouse moves onto, along and off a menu option of the selected room (null when off) */
  onHover?: (hover: Hover | null) => void,
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
  const livingMoulding = buildLivingMoulding(scene, (p, parts) => apartment.attachToWall('living', p, parts));
  const office = buildOffice(scene);
  const roomLamps = addRoomLamps(scene);
  for (const l of apartment.windowLights) scene.add(l, l.target);

  /* the scene is drawn only when something changes: a setting, the camera, the canvas size or a piece loading */
  let dirty = true;
  const invalidate = () => {
    dirty = true;
  };

  /* the models are meshopt-compressed (see README) */
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  /* the sofa's cover, a Bemz fabric or the model's own (see sofaFabric) */
  const fabric = sofaFabric(invalidate);
  const furniture = loadFurniture(
    scene,
    (piece) => (piece.file ? gltf.loadAsync(import.meta.env.BASE_URL + piece.file).then((g) => g.scene) : Promise.resolve(quebecRug())),
    invalidate,
    (id, obj) => {
      tagOption([obj], 'living', [id === 'sofa' ? 'sofa' : 'furniture']);
      if (id === 'sofa') fabric.attach(obj);
    },
  );
  let furnitureReady = false;
  void furniture.ready.then(() => (furnitureReady = true));

  const roomLights = addRoomLights(scene);
  const sky = addSkyAndSun(scene);
  const pipeline = renderPipeline(renderer, scene, camera);

  /* the selected room: hovering highlights only its options */
  let selected: RoomSelection = initial.room;
  const highlight = highlighter(scene, invalidate);

  function apply(s: Settings) {
    invalidate();
    selected = s.room;
    const evening = s.time === 'eve';
    bedroom.apply(s);
    office.apply(s);
    livingMoulding.apply(s);
    for (const r of ROOMS) apartment.rooms[r.id].wall.color.copy(lin(findById(PAINTS, s.walls[r.id]).hex));
    furniture.setHidden(s.living.hidden);
    fabric.set(s.living.sofaFabric);
    sky.setEvening(evening);
    pipeline.setEvening(evening);
    for (const l of [...bedroom.windowLights, ...apartment.windowLights]) setWindowSpot(l, evening);
    roomLamps.apply(s);
    roomLights.apply(s);
    /* a room change leaves options of the old room under the mouse; settings may rebuild or recolour parts */
    if (lastHover && lastHover.option.room !== selected) setHover(null);
    highlight.refresh();
  }

  const ndcOf = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
  };
  const orbit = orbitCamera(canvas, camera, VIEWS[0].pose, (ndc) => {
    setHover(null);
    onPick?.(pick(ndc, camera, scene.children, ROOMS));
  });

  /* hovering with a mouse (not touch, not while dragging) points at the selected room's options */
  let lastHover: Hover | null = null;
  function setHover(h: Hover | null) {
    highlight.set(h?.option ?? null);
    canvas.classList.toggle('pointing', !!h);
    if (h || lastHover) onHover?.(h);
    lastHover = h;
  }
  let hoverAt: { clientX: number; clientY: number } | null = null;
  let hoverFrame = 0;
  function checkHover() {
    hoverFrame = 0;
    if (!hoverAt || selected === 'all') return setHover(null);
    const { option } = pick(ndcOf(hoverAt), camera, scene.children, ROOMS);
    if (!option || option.room !== selected) return setHover(null);
    const r = container.getBoundingClientRect();
    setHover({ option, x: hoverAt.clientX - r.left, y: hoverAt.clientY - r.top });
  }
  const onHoverMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons) {
      hoverAt = null;
      setHover(null);
      return;
    }
    hoverAt = e;
    if (!hoverFrame) hoverFrame = requestAnimationFrame(checkHover);
  };
  const onHoverLeave = () => {
    hoverAt = null;
    setHover(null);
  };
  canvas.addEventListener('pointermove', onHoverMove);
  canvas.addEventListener('pointerleave', onHoverLeave);

  /* the pending animation frame; 0 until the first frame */
  let raf = 0;
  function fit() {
    const r = container.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h, ratio);
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
    pipeline.render();
    dirty = false;
  }
  /* a restored WebGL context starts blank */
  canvas.addEventListener('webglcontextrestored', invalidate);
  function frame() {
    const { moved, arrived } = orbit.update();
    if (moved || dirty) draw();
    /* lets screenshot tests wait for a still frame: the camera has arrived, and the furniture and the sofa's fabric
       have loaded */
    const settled = String(arrived && furnitureReady && fabric.settled);
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
      cancelAnimationFrame(hoverFrame);
      canvas.removeEventListener('pointermove', onHoverMove);
      canvas.removeEventListener('pointerleave', onHoverLeave);
      highlight.dispose();
      furniture.dispose();
      fabric.dispose();
      disposeTree(scene);
      bedroom.dispose();
      office.dispose();
      livingMoulding.dispose();
      roomLamps.dispose();
      pipeline.dispose();
      renderer.dispose();
    },
  };
}
