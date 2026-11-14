import { CREAM, OAT, TERRACOTTA } from '../data/catalog';

/*
 * Drawing on 2D canvases, without three.js: the seeded random numbers every procedural texture uses, and the rug
 * patterns, which the side panel also shows as thumbnails. textures.ts turns canvases into three.js textures.
 */

/* ---------- seeded RNG (mulberry32) so procedural textures are stable between loads ---------- */
let seed = 7;
export function reseed(n: number): void {
  seed = n;
}
export function R(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function speckle(g: Ctx, w: number, h: number, n: number, a: number): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * a})` : `rgba(255,255,255,${R() * a})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}

/* ---------- rugs ---------- */
const RW = 512;
const RH = 768;

const rugDraw: Record<string, (g: Ctx) => void> = {
  naver(g) {
    g.fillStyle = OAT;
    g.fillRect(0, 0, RW, RH);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = i % 2 ? 'rgba(120,98,66,.13)' : 'rgba(255,255,255,.22)';
      g.lineWidth = 1 + R() * 3;
      g.beginPath();
      const x = R() * RW;
      const y = R() * RH;
      g.moveTo(x, y);
      g.bezierCurveTo(x + R() * 70 - 35, y + 30, x + R() * 70 - 35, y + 80, x + R() * 50 - 25, y + 120 + R() * 80);
      g.stroke();
    }
    speckle(g, RW, RH, 24000, 0.09);
  },
  chessie(g) {
    const cw = RW / 8;
    const ch = RH / 12;
    for (let r = 0; r < 12; r++)
      for (let c = 0; c < 8; c++) {
        g.fillStyle = (r + c) % 2 ? CREAM : TERRACOTTA;
        g.fillRect(c * cw, r * ch, cw + 1, ch + 1);
      }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(60,20,10,.07)';
      g.beginPath();
      g.ellipse(R() * RW, R() * RH, 20 + R() * 50, 12 + R() * 30, R() * 3, 0, 7);
      g.fill();
    }
    speckle(g, RW, RH, 26000, 0.1);
  },
  rista(g) {
    g.fillStyle = '#A5472E';
    g.fillRect(0, 0, RW, RH);
    g.fillStyle = OAT;
    g.fillRect(58, 58, RW - 116, RH - 116);
    g.strokeStyle = CREAM;
    g.lineWidth = 5;
    g.strokeRect(74, 74, RW - 148, RH - 148);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(120,98,66,.05)';
      g.beginPath();
      g.ellipse(R() * RW, R() * RH, 30 + R() * 60, 10 + R() * 30, R() * 3, 0, 7);
      g.fill();
    }
    speckle(g, RW, RH, 26000, 0.09);
  },
  palma(g) {
    g.fillStyle = '#3E5944';
    g.fillRect(0, 0, RW, RH);
    for (let k = 0; k < 4; k++) {
      const bx = 64 + k * 128;
      const ph = k * 1.3;
      g.strokeStyle = '#6F8C70';
      g.lineWidth = 3;
      g.beginPath();
      for (let y = 0; y <= RH; y += 8) {
        const x = bx + Math.sin(y / 55 + ph) * 26;
        if (y === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      for (let y2 = 20; y2 < RH; y2 += 46) {
        const x2 = bx + Math.sin(y2 / 55 + ph) * 26;
        const dir = ((y2 / 46) | 0) % 2 ? 1 : -1;
        g.fillStyle = ((y2 / 46) | 0) % 3 === 0 ? '#8FA68C' : '#5E7C60';
        g.beginPath();
        g.ellipse(x2 + dir * 18, y2, 18, 7, dir * -0.5, 0, 7);
        g.fill();
      }
    }
    speckle(g, RW, RH, 26000, 0.1);
  },
  stoense(g) {
    g.fillStyle = '#E4DFD0';
    g.fillRect(0, 0, RW, RH);
    speckle(g, RW, RH, 30000, 0.07);
  },
};

let rugCanvases: Record<string, HTMLCanvasElement> | null = null;

/** Rug pattern canvases, drawn once. Empty if the browser has no 2D canvas. */
export function getRugCanvases(): Record<string, HTMLCanvasElement> {
  if (rugCanvases) return rugCanvases;
  const out: Record<string, HTMLCanvasElement> = {};
  for (const id of Object.keys(rugDraw)) {
    const c = makeCanvas(RW, RH);
    const g = c.getContext('2d');
    if (!g) return (rugCanvases = {});
    reseed(id.length * 97 + 13);
    rugDraw[id](g);
    out[id] = c;
  }
  return (rugCanvases = out);
}

const thumbCache: Record<string, string> = {};
/** JPEG data URL of a rug pattern for the side panel, or '' when unavailable. */
export function rugThumbnail(id: string): string {
  if (id in thumbCache) return thumbCache[id];
  const c = getRugCanvases()[id];
  let url: string;
  try {
    url = c ? c.toDataURL('image/jpeg', 0.7) : '';
  } catch {
    url = '';
  }
  return (thumbCache[id] = url);
}


/* ---------- round rugs ---------- */
const RR = 512;

/* The canvases are square with the design centred and inside the disc they are mapped onto. */
function disc(g: Ctx, r: number, fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(RR / 2, RR / 2, r, 0, Math.PI * 2);
  g.fill();
}

const roundRugDraw: Record<string, (g: Ctx) => void> = {
  /* plain natural jute, flat weave */
  jute(g) {
    g.fillStyle = '#C2A675';
    g.fillRect(0, 0, RR, RR);
    for (let y = 0; y < RR; y += 4) {
      g.fillStyle = (y / 4) % 2 ? 'rgba(90,64,30,.16)' : 'rgba(255,240,200,.14)';
      g.fillRect(0, y, RR, 2);
    }
    for (let x = 0; x < RR; x += 4) {
      g.fillStyle = (x / 4) % 3 ? 'rgba(90,64,30,.08)' : 'rgba(255,240,200,.1)';
      g.fillRect(x, 0, 1.5, RR);
    }
    speckle(g, RR, RR, 14000, 0.12);
  },
  /* concentric natural and white rings */
  rings(g) {
    g.fillStyle = '#E9E3D3';
    g.fillRect(0, 0, RR, RR);
    const bands = 9;
    for (let i = 0; i < bands; i++) {
      disc(g, RR / 2 - (i * RR) / 2 / bands, i % 2 ? '#F1EDE2' : '#C9B58E');
    }
    for (let y = 0; y < RR; y += 4) {
      g.fillStyle = 'rgba(90,64,30,.07)';
      g.fillRect(0, y, RR, 1.5);
    }
    speckle(g, RR, RR, 14000, 0.1);
  },
  /* plain beige wool, a soft mottled pile */
  wool(g) {
    g.fillStyle = '#D9CBAE';
    g.fillRect(0, 0, RR, RR);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(120,98,66,.07)';
      g.beginPath();
      g.ellipse(R() * RR, R() * RR, 20 + R() * 50, 10 + R() * 28, R() * 3, 0, 7);
      g.fill();
    }
    speckle(g, RR, RR, 26000, 0.09);
  },
  /* cubes in a rainbow of colours on a cream ground */
  cubes(g) {
    g.fillStyle = '#EDE6D6';
    g.fillRect(0, 0, RR, RR);
    const cols = ['#C8553D', '#E0A458', '#6B8F71', '#4F7CAC', '#8E6C8A', '#D98E73'];
    const n = 8;
    const s = RR / n;
    g.save();
    g.beginPath();
    g.arc(RR / 2, RR / 2, RR / 2, 0, Math.PI * 2);
    g.clip();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        g.fillStyle = cols[(r * 3 + c * 5 + ((r * c) % 4)) % cols.length];
        g.fillRect(c * s + 5, r * s + 5, s - 10, s - 10);
      }
    g.restore();
    speckle(g, RR, RR, 18000, 0.08);
  },
};

let roundRugCanvases: Record<string, HTMLCanvasElement> | null = null;

/** Round rug pattern canvases (square), keyed by pattern, drawn once. Empty if the browser has no 2D canvas. */
export function getRoundRugCanvases(): Record<string, HTMLCanvasElement> {
  if (roundRugCanvases) return roundRugCanvases;
  const out: Record<string, HTMLCanvasElement> = {};
  for (const id of Object.keys(roundRugDraw)) {
    const c = makeCanvas(RR, RR);
    const g = c.getContext('2d');
    if (!g) return (roundRugCanvases = {});
    reseed(id.length * 89 + 31);
    roundRugDraw[id](g);
    out[id] = c;
  }
  return (roundRugCanvases = out);
}

const roundThumbCache: Record<string, string> = {};
/** JPEG data URL of a round rug pattern for the side panel, or '' when unavailable. */
export function roundRugThumbnail(pattern: string): string {
  if (pattern in roundThumbCache) return roundThumbCache[pattern];
  const c = getRoundRugCanvases()[pattern];
  let url: string;
  try {
    url = c ? c.toDataURL('image/jpeg', 0.7) : '';
  } catch {
    url = '';
  }
  return (roundThumbCache[pattern] = url);
}
