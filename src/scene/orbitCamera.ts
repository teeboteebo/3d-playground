import * as THREE from 'three';
import type { CameraPose } from '../data/catalog';
import { clamp } from '../lib/math';
import { isClick } from './pickRoom';

export interface OrbitCamera {
  /** ease towards a pose; fields left out (e.g. the rotation) stay as they are */
  setView(pose: Partial<CameraPose>): void;
  /** step the easing and place the camera: whether it moved this step, and whether it has come to rest */
  update(): { moved: boolean; arrived: boolean };
  dispose(): void;
}

/** how far one press of an arrow key turns the camera (rad), and one press of + or - zooms */
const KEY_TURN = 0.12;
const KEY_TILT = 0.08;
const KEY_ZOOM = 0.85;

/** the camera's limits: how far it tilts (rad from straight down) and how near and far it goes (m) */
const PHI = { min: 0.15, max: 1.5 };
const DIST = { min: 3, max: 32 };

/** whether the user has asked for less motion: the camera then jumps to a pose instead of easing there */
function reducedMotion(): () => boolean {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  return () => !!q?.matches;
}

/**
 * Orbits `camera` around a pivot: drag to rotate, wheel or pinch to zoom, eased towards a goal pose; with the canvas
 * focused, the arrow keys turn and tilt it and + and - zoom. A press that neither drags nor pinches is a click,
 * reported in normalised device coordinates. `onUserMove` is told whenever the user moves the camera themselves.
 */
export function orbitCamera(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  start: CameraPose,
  onClick: (ndc: { x: number; y: number }) => void,
  onUserMove?: () => void,
): OrbitCamera {
  const still = reducedMotion();
  const cur: CameraPose = { ...start };
  const goal: CameraPose = { ...start };
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
      goal.phi = clamp(goal.phi - dy * 0.005, PHI.min, PHI.max);
    } else if (pts.size === 2) {
      const d = pinchDistance();
      if (lastPinch > 0) goal.dist = clamp((goal.dist * lastPinch) / d, DIST.min, DIST.max);
      lastPinch = d;
    }
    if (dx !== 0 || dy !== 0) onUserMove?.();
  };
  const onUp = (e: PointerEvent) => {
    const last = pts.size === 1 && pts.has(e.pointerId);
    pts.delete(e.pointerId);
    if (last) travel(e);
    if (last && e.type === 'pointerup' && isClick(pressTravel, pressPointers)) {
      const r = canvas.getBoundingClientRect();
      onClick({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 });
    }
    lastPinch = 0;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0012), DIST.min, DIST.max);
    onUserMove?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowLeft': goal.theta += KEY_TURN; break;
      case 'ArrowRight': goal.theta -= KEY_TURN; break;
      case 'ArrowUp': goal.phi = clamp(goal.phi - KEY_TILT, PHI.min, PHI.max); break;
      case 'ArrowDown': goal.phi = clamp(goal.phi + KEY_TILT, PHI.min, PHI.max); break;
      case '+': case '=': case 'PageUp': goal.dist = clamp(goal.dist * KEY_ZOOM, DIST.min, DIST.max); break;
      case '-': case '_': case 'PageDown': goal.dist = clamp(goal.dist / KEY_ZOOM, DIST.min, DIST.max); break;
      default: return;
    }
    e.preventDefault();
    onUserMove?.();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);

  const keys = Object.keys(cur) as (keyof CameraPose)[];
  return {
    setView(pose) {
      Object.assign(goal, pose);
    },
    update() {
      /* ease towards the goal, and snap onto it once close, so the camera comes to rest exactly there */
      const moved = keys.some((k) => cur[k] !== goal[k]);
      const arriving = still() || keys.every((k) => Math.abs(goal[k] - cur[k]) < 1e-3);
      for (const k of keys) cur[k] = arriving ? goal[k] : cur[k] + (goal[k] - cur[k]) * 0.14;
      /* pull back on narrow (portrait) screens so the room still fits across */
      const d = cur.dist * Math.max(1, 1.15 / camera.aspect);
      camera.position.set(
        cur.tx + d * Math.sin(cur.phi) * Math.sin(cur.theta),
        cur.ty + d * Math.cos(cur.phi),
        cur.tz + d * Math.sin(cur.phi) * Math.cos(cur.theta),
      );
      camera.lookAt(cur.tx, cur.ty, cur.tz);
      return { moved, arrived: arriving };
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
    },
  };
}
