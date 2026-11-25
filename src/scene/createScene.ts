import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FLOOR, OAK, PAINTS, VIEWS, findById, type CameraPose } from '../data/catalog';
import { ROOMS, type RoomId, type RoomSelection } from '../data/rooms';
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
import { highlighter, type HighlightTarget } from './highlight';
import { pick, type Pick } from './pickRoom';
import type { SceneOption } from './options';
import { renderPipeline } from './pipeline';
import { quebecRug } from './quebecRug';
import { sideboard } from './sideboard';
import { addRoomLamps } from './roomLamps';
import { addRoomLights } from './roomLights';
import { sofaFabric } from './sofaFabric';
import { floorTexture, woodTexture } from './textures';

export interface ApartmentScene {
  apply(settings: Settings): void;
  /** ease the camera to a pose; fields left out (e.g. the rotation) stay as they are */
  setView(pose: Partial<CameraPose>): void;
  /** highlights the option a menu row points at, and every option under it (null for none); the mouse over the 3D view wins */
  pointAt(option: SceneOption | null): void;
  /** highlights these pieces of the selected room, as the selection, under what the mouse or a menu row points at (null for none) */
  select(ids: readonly string[] | null): void;
  /** widens what the mouse over a piece highlights to the group it stands for: the ids of that group, or null for the piece alone */
  groupOf(resolve: ((option: SceneOption) => readonly string[] | null) | null): void;
  dispose(): void;
}

/**
 * What a click would do under the mouse, and where the mouse is in the container (px): open `option` in the selected
 * room, or (option null) select `room`
 */
export interface Hover {
  room: RoomId;
  option: SceneOption | null;
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
  onPick?: (pick: Pick, modifiers: { shift: boolean }) => void,
  /** called as the mouse moves onto, along and off a menu option of the selected room (null when off) */
  onHover?: (hover: Hover | null) => void,
  /** called whenever the user moves the camera themselves (drag, pinch, wheel or keys) */
  onCameraMove?: () => void,
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

  const bedroom = buildBedroom(scene, initial.rooms.bedroom.accent);

  /* every room's walls, floor and ceiling, and the other rooms' doors and windows, in the bedroom's trim and glass */
  const apartment = buildApartment({
    trim: bedroom.shared.trim,
    glass: bedroom.shared.glass,
    floor: () => new THREE.MeshStandardMaterial({ roughness: 0.42 }),
    threshold: new THREE.MeshStandardMaterial({ roughness: 0.55, map: woodTexture(OAK.hex) }),
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
    (piece) =>
      piece.file
        ? gltf.loadAsync(import.meta.env.BASE_URL + piece.file).then((g) => g.scene)
        : Promise.resolve(piece.id === 'tv-bench' ? sideboard() : quebecRug()),
    invalidate,
    (id, obj) => {
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
    for (const r of ROOMS) apartment.rooms[r.id].wall.color.copy(lin(findById(PAINTS, s.rooms[r.id].paint).hex));
    const living = s.rooms.living.components;
    furniture.setShown((id) => living[id as keyof typeof living]?.shown ?? true);
    fabric.set(living.sofa.options.fabric ?? 'original');
    sky.setEvening(evening);
    pipeline.setEvening(evening);
    for (const l of [...bedroom.windowLights, ...apartment.windowLights]) setWindowSpot(l, evening);
    roomLamps.apply(s);
    roomLights.apply(s);
    /* a room change makes what is under the mouse mean something else; settings may rebuild or recolour parts */
    if (lastHover && (lastHover.room === selected) !== !!lastHover.option) setHover(null);
    highlight.set(shown(lastHover));
    highlight.refresh();
  }

  const ndcOf = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
  };
  const orbit = orbitCamera(canvas, camera, VIEWS[0].pose, (ndc, shift) => {
    setHover(null);
    onPick?.(pick(ndc, camera, scene.children, ROOMS), { shift });
  }, onCameraMove);

  /* hovering with a mouse (not touch, not while dragging) points at the selected room's options, and at the other
     rooms a click would select */
  let lastHover: Hover | null = null;
  /* what a menu row points at, shown while the mouse points at nothing in 3D */
  let pointed: HighlightTarget | null = null;
  let selection: readonly string[] | null = null;
  let groupOf: ((option: SceneOption) => readonly string[] | null) | null = null;
  const hoverTarget = (h: Hover | null): HighlightTarget | null => {
    if (!h) return null;
    if (!h.option) return { kind: 'room', room: h.room };
    const ids = groupOf?.(h.option);
    return ids ? { kind: 'leaves', room: h.option.room, ids } : { kind: 'option', option: h.option };
  };
  const selectionTarget = (): HighlightTarget | null =>
    selection && selected !== 'all' ? { kind: 'leaves', room: selected, ids: selection } : null;
  const shown = (h: Hover | null) => hoverTarget(h) ?? pointed ?? selectionTarget();
  function setHover(h: Hover | null) {
    highlight.set(shown(h));
    canvas.classList.toggle('pointing', !!h);
    if (h || lastHover) onHover?.(h);
    lastHover = h;
  }
  let hoverAt: { clientX: number; clientY: number } | null = null;
  let hoverFrame = 0;
  function checkHover() {
    hoverFrame = 0;
    if (!hoverAt) return setHover(null);
    const { room, option } = pick(ndcOf(hoverAt), camera, scene.children, ROOMS);
    const inSelected = room !== null && room === selected;
    /* in the selected room only its options react; any other room reacts as a whole */
    if (!room || (inSelected && option?.room !== selected)) return setHover(null);
    const r = container.getBoundingClientRect();
    setHover({ room, option: inSelected ? option : null, x: hoverAt.clientX - r.left, y: hoverAt.clientY - r.top });
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
    pointAt(option) {
      pointed = option ? { kind: 'option', option, within: true } : null;
      highlight.set(shown(lastHover));
    },
    select(ids) {
      selection = ids;
      highlight.set(shown(lastHover));
    },
    groupOf(resolve) {
      groupOf = resolve;
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
