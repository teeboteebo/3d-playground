import type * as THREE from 'three';
import type { FabricKind } from '../data/fabrics';
import { R, makeCanvas, reseed, speckle, type Ctx } from './canvas';
import { canvasTexture } from './textures';

/** a plain fabric's look: its colour times a near-white detail map, tiled seamlessly in world space */
export interface FabricDetail {
  /** greyscale, near white; null where there is no 2D canvas (tests) */
  map: THREE.Texture | null;
  /** metres per tile */
  scale: number;
  /** roughness, or null to keep the model's own */
  roughness: number | null;
  /** 1 / the map's mean (linear) value: multiplied into the colour so the fabric averages to its swatch colour */
  gain: number;
}

const S = 256;

/** draws `f` at its position and wrapped across each edge, so the tile repeats without seams */
function wrapped(f: (dx: number, dy: number) => void): void {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy);
}

const grey = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;

type PlainKind = Exclude<FabricKind, 'pattern'>;

const DRAW: Record<PlainKind, { scale: number; roughness: number | null; draw: (g: Ctx) => void }> = {
  /* linen, cotton, twill, panama: a fine over-under crosshatch with the odd thicker thread (slub) */
  weave: {
    scale: 0.08,
    roughness: null,
    draw(g) {
      g.fillStyle = grey(240);
      g.fillRect(0, 0, S, S);
      const t = 4;
      for (let i = 0; i < S / t; i++) {
        for (let j = 0; j < S / t; j++) {
          const over = (i + j) % 2 === 0;
          g.fillStyle = grey(over ? 250 : 226);
          if (over) g.fillRect(j * t, i * t + 1, t, t - 2);
          else g.fillRect(j * t + 1, i * t, t - 2, t);
        }
      }
      for (let k = 0; k < 110; k++) {
        const x = R() * S;
        const y = Math.floor(R() * (S / t)) * t + 1;
        const w = 10 + R() * 40;
        const v = R() < 0.5 ? 255 : 215;
        const a = 0.35 + R() * 0.3;
        wrapped((dx, dy) => {
          g.fillStyle = grey(v, a);
          g.fillRect(x + dx, y + dy, w, t - 1.5);
        });
      }
      speckle(g, S, S, 3000, 0.05);
    },
  },
  /* bouclé, tweed, melange, chenille, wool: small irregular loops and nubs */
  textured: {
    scale: 0.15,
    roughness: null,
    draw(g) {
      g.fillStyle = grey(238);
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 1400; k++) {
        const x = R() * S;
        const y = R() * S;
        const r = 1.5 + R() * 3.5;
        const v = R() < 0.55 ? 255 : 200;
        const a = 0.25 + R() * 0.35;
        const start = R() * Math.PI * 2;
        const lw = 0.8 + R() * 1.4;
        wrapped((dx, dy) => {
          g.strokeStyle = grey(v, a);
          g.lineWidth = lw;
          g.beginPath();
          g.arc(x + dx, y + dy, r, start, start + Math.PI * (1.2 + R() * 0.6));
          g.stroke();
        });
      }
      speckle(g, S, S, 4000, 0.08);
    },
  },
  /* velvet, teddy: a soft, barely-there mottling of the pile, and a little sheen */
  velvet: {
    scale: 0.2,
    roughness: 0.6,
    draw(g) {
      g.fillStyle = grey(240);
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 40; k++) {
        const x = R() * S;
        const y = R() * S;
        const r = 20 + R() * 45;
        const v = R() < 0.5 ? 255 : 210;
        const a = 0.12 + R() * 0.12;
        wrapped((dx, dy) => {
          const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          gr.addColorStop(0, grey(v, a));
          gr.addColorStop(1, grey(v, 0));
          g.fillStyle = gr;
          g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
        });
      }
      speckle(g, S, S, 2500, 0.04);
    },
  },
  /* corduroy: fine parallel ribs, rounded (light on top, dark in the furrow) */
  cord: {
    scale: 0.08,
    roughness: null,
    draw(g) {
      const rib = 32;
      for (let x = 0; x < S; x += rib) {
        const gr = g.createLinearGradient(x, 0, x + rib, 0);
        gr.addColorStop(0, grey(205));
        gr.addColorStop(0.2, grey(240));
        gr.addColorStop(0.5, grey(252));
        gr.addColorStop(0.8, grey(240));
        gr.addColorStop(1, grey(205));
        g.fillStyle = gr;
        g.fillRect(x, 0, rib, S);
      }
      speckle(g, S, S, 3000, 0.05);
    },
  },
  /* satin: nearly flat, with faint streaks along the warp and a low roughness for its sheen */
  satin: {
    scale: 0.15,
    roughness: 0.45,
    draw(g) {
      g.fillStyle = grey(246);
      g.fillRect(0, 0, S, S);
      for (let k = 0; k < 60; k++) {
        const y = R() * S;
        const h = 1 + R() * 3;
        const v = R() < 0.5 ? 255 : 228;
        g.fillStyle = grey(v, 0.25 + R() * 0.25);
        g.fillRect(0, y, S, h);
        if (y + h > S) g.fillRect(0, y - S, S, h);
      }
    },
  },
};

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const cache = new Map<FabricKind, FabricDetail>();

/** a plain fabric kind's detail, drawn once and shared by every fabric of that kind (never disposed per fabric) */
export function fabricDetail(kind: PlainKind): FabricDetail {
  const hit = cache.get(kind);
  if (hit) return hit;
  const { scale, roughness, draw } = DRAW[kind];
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  let detail: FabricDetail = { map: null, scale, roughness, gain: 1 };
  if (g) {
    reseed(kind.length * 7919 + kind.charCodeAt(0));
    draw(g);
    const px = g.getImageData(0, 0, S, S).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += toLinear(px[i] / 255);
    detail = { map: canvasTexture(c, true), scale, roughness, gain: px.length / 4 / sum };
  }
  cache.set(kind, detail);
  return detail;
}
