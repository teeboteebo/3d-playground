import * as THREE from 'three';
import { BRASS, CREAM, INK, OAT, SAGE } from '../data/catalog';
import { R, makeCanvas, reseed, speckle, type Ctx } from './canvas';

export { getRugCanvases, rugThumbnail } from './canvas';

export function canvasTexture(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---------- wood, floor, woven seat, mirror, art ---------- */
export function woodTexture(hex: string): THREE.CanvasTexture {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d')!;
  reseed(11);
  g.fillStyle = hex;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 130; i++) {
    const y = R() * 512;
    const a = 0.04 + R() * 0.09;
    const w = 1 + R() * 3;
    const ph = R() * 6;
    const amp = 2 + R() * 6;
    g.strokeStyle = R() < 0.6 ? `rgba(70,40,15,${a})` : `rgba(255,240,210,${a})`;
    g.lineWidth = w;
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const yy = y + Math.sin(x / 70 + ph) * amp;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  speckle(g, 512, 512, 6000, 0.05);
  return canvasTexture(c, true);
}

/** Herringbone with a straight-plank border (stavparkett), for a roomWidth-metre wide floor. */
/**
 * Parquet for a room `roomWidth` metres wide. Without `roomDepth` the canvas is the bedroom's 2048 × 1880;
 * with it, the canvas takes the room's proportions at the bedroom's plank density (max 2048 px a side).
 */
export function floorTexture(hex: string, roomWidth: number, roomDepth?: number): THREE.CanvasTexture {
  const ppm = roomDepth === undefined ? 2048 / roomWidth : Math.min(2048 / 4.3, 2048 / Math.max(roomWidth, roomDepth));
  const cw = Math.round(roomWidth * ppm);
  const ch = roomDepth === undefined ? 1880 : Math.round(roomDepth * ppm);
  const c = makeCanvas(cw, ch);
  const g = c.getContext('2d')!;
  reseed(23);
  const n = parseInt(hex.slice(1), 16);
  const br = (n >> 16) & 255;
  const bg = (n >> 8) & 255;
  const bb = n & 255;
  const pw = 0.09 * ppm;
  const k = 5;
  g.fillStyle = '#3A2C1E';
  g.fillRect(0, 0, cw, ch);
  const rows = 1;
  const fw = 1.5 * pw;
  const plen = 14 * pw;
  g.save();
  g.beginPath();
  g.rect(fw, fw, cw - 2 * fw, ch - 2 * fw);
  g.clip();
  g.translate(cw / 2, ch / 2);
  g.rotate(Math.PI / 4);
  const N = Math.ceil(Math.hypot(cw, ch) / pw / 2) + k + 2;

  function plank(x: number, y: number, w: number, h: number, horiz: boolean) {
    const sh = (R() - 0.5) * 0.07;
    const wm = (R() - 0.5) * 0.02;
    const ch8 = (v: number, m: number) => Math.max(0, Math.min(255, Math.round(v * (1 + sh + m))));
    g.fillStyle = `rgb(${ch8(br, wm)},${ch8(bg, 0)},${ch8(bb, -wm)})`;
    g.fillRect(x + 0.8, y + 0.8, w - 1.6, h - 1.6);
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = R() < 0.5 ? `rgba(60,35,12,${0.05 + R() * 0.07})` : `rgba(255,240,215,${0.05 + R() * 0.06})`;
      g.lineWidth = 0.8 + R() * 1.4;
      g.beginPath();
      if (horiz) {
        const yy = y + 2 + R() * (h - 4);
        g.moveTo(x + 1, yy);
        g.lineTo(x + w - 1, yy + (R() - 0.5) * 3);
      } else {
        const xx = x + 2 + R() * (w - 4);
        g.moveTo(xx, y + 1);
        g.lineTo(xx + (R() - 0.5) * 3, y + h - 1);
      }
      g.stroke();
    }
  }

  for (let y = -N; y <= N; y++) {
    for (let x = -N; x <= N; x++) {
      const m = (((x - y) % (2 * k)) + 2 * k) % (2 * k);
      if (m === 0) plank(x * pw, y * pw, k * pw, pw, true);
      if (m === k) plank(x * pw, (y - k + 1) * pw, pw, k * pw, false);
    }
  }
  g.restore();

  function side(poly: number[], fn: () => void) {
    g.save();
    g.beginPath();
    g.moveTo(poly[0], poly[1]);
    for (let i = 2; i < poly.length; i += 2) g.lineTo(poly[i], poly[i + 1]);
    g.closePath();
    g.clip();
    fn();
    g.restore();
  }
  const off = (r: number) => ((r * 0.37) % 1) * plen;
  side([0, 0, cw, 0, cw - fw, fw, fw, fw], () => {
    for (let r = 0; r < rows; r++) for (let x = -plen + off(r); x < cw; x += plen) plank(x, r * fw, plen, fw, true);
  });
  side([0, ch, cw, ch, cw - fw, ch - fw, fw, ch - fw], () => {
    for (let r = 0; r < rows; r++) for (let x = -plen + off(r); x < cw; x += plen) plank(x, ch - (r + 1) * fw, plen, fw, true);
  });
  side([0, 0, fw, fw, fw, ch - fw, 0, ch], () => {
    for (let r = 0; r < rows; r++) for (let y = -plen + off(r); y < ch; y += plen) plank(r * fw, y, fw, plen, false);
  });
  side([cw, 0, cw - fw, fw, cw - fw, ch - fw, cw, ch], () => {
    for (let r = 0; r < rows; r++) for (let y = -plen + off(r); y < ch; y += plen) plank(cw - (r + 1) * fw, y, fw, plen, false);
  });
  return canvasTexture(c, false);
}

export function weaveTexture(): THREE.CanvasTexture {
  /* the RNG state this texture has always been drawn from, fixed so it no longer depends on what was drawn first */
  reseed(-1653740271);
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d')!;
  g.fillStyle = '#CDB48C';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 64; i++) {
    const yy = i * 4;
    g.fillStyle = i % 2 ? '#D8C29C' : '#C2A87D';
    g.fillRect(0, yy, 256, 3);
    for (let k = 0; k < 32; k++) {
      g.fillStyle = 'rgba(90,65,30,.18)';
      g.fillRect(k * 8 + (i % 2) * 4, yy, 1.5, 3);
    }
  }
  speckle(g, 256, 256, 2500, 0.05);
  return canvasTexture(c, false);
}

export function mirrorTexture(): THREE.CanvasTexture {
  const c = makeCanvas(128, 512);
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#E4ECF0');
  gr.addColorStop(0.55, '#C9CCC4');
  gr.addColorStop(1, '#A9A596');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 512);
  g.fillStyle = 'rgba(255,255,255,.38)';
  g.beginPath();
  g.moveTo(14, 0);
  g.lineTo(74, 0);
  g.lineTo(22, 512);
  g.lineTo(-38, 512);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.2)';
  g.beginPath();
  g.moveTo(92, 0);
  g.lineTo(110, 0);
  g.lineTo(58, 512);
  g.lineTo(40, 512);
  g.fill();
  return canvasTexture(c, false);
}

const artDraw: Record<string, (g: Ctx, w: number, h: number, accent: string) => void> = {
  sun(g, w, h, accent) {
    g.fillStyle = CREAM;
    g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    g.beginPath();
    g.arc(w * 0.5, h * 0.46, h * 0.27, 0, 7);
    g.fill();
    g.fillStyle = INK;
    g.fillRect(0, h * 0.68, w, h * 0.32);
    g.fillStyle = BRASS;
    g.fillRect(0, h * 0.68, w, 4);
    g.fillStyle = SAGE;
    g.beginPath();
    g.arc(w * 0.5, h * 0.68, h * 0.27, Math.PI, 0);
    g.fill();
  },
  hills(g, w, h, accent) {
    g.fillStyle = '#F3EFE2';
    g.fillRect(0, 0, w, h);
    const layers: [string, number, number][] = [
      ['#D9CDB4', 0.42, 0.0],
      [accent, 0.55, 1.4],
      ['#6E7667', 0.68, 2.6],
      ['#2F3E36', 0.82, 3.8],
    ];
    for (const [col, base, ph] of layers) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) g.lineTo(x, h * base + Math.sin((x / w) * 5 + ph) * h * 0.06);
      g.lineTo(w, h);
      g.fill();
    }
  },
  arches(g, w, h, accent) {
    g.fillStyle = OAT;
    g.fillRect(0, 0, w, h);
    const cols = [accent, CREAM, '#6E7667'];
    for (let i = 0; i < 3; i++) {
      const x = w * (0.17 + i * 0.28);
      const aw = w * 0.22;
      const top = h * (0.28 + (i === 1 ? -0.06 : 0.04));
      g.fillStyle = cols[i];
      g.beginPath();
      g.moveTo(x, h * 0.86);
      g.lineTo(x, top + aw / 2);
      g.arc(x + aw / 2, top + aw / 2, aw / 2, Math.PI, 0);
      g.lineTo(x + aw, h * 0.86);
      g.fill();
    }
    g.fillStyle = INK;
    g.fillRect(w * 0.08, h * 0.86, w * 0.84, 5);
  },
};

export function artTexture(id: string, accent: string): THREE.CanvasTexture {
  const c = makeCanvas(410, 260);
  const g = c.getContext('2d')!;
  (artDraw[id] ?? artDraw.sun)(g, 410, 260, accent);
  reseed(31);
  speckle(g, 410, 260, 3000, 0.04);
  return canvasTexture(c, false);
}

/**
 * ILVA Quebec kilim: plain light-greige wool in chunky braided ribs that run the rug's length, with a tighter
 * woven band at each short end. Drawn at 4 px per cm for the 350 × 250 cm size (u along the length).
 */
export function quebecRugTexture(): THREE.CanvasTexture {
  const W = 1400;
  const H = 1000;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d')!;
  reseed(41);
  g.fillStyle = '#B7AE9F';
  g.fillRect(0, 0, W, H);
  const ROW = 10; // a 2.5 cm braid
  const END = 16; // 4 cm woven band at each end
  for (let r = 0; r * ROW < H; r++) {
    const y = r * ROW;
    const dir = r % 2 ? 1 : -1;
    /* each braid is a run of slanted loops; alternate rows lean the other way, like a herringbone braid */
    for (let x = END - 6; x < W - END + 6; x += 7) {
      const t = 0.9 + R() * 0.2;
      g.fillStyle = `rgb(${Math.round(196 * t)},${Math.round(188 * t)},${Math.round(174 * t)})`;
      g.beginPath();
      g.moveTo(x, y + 1);
      g.lineTo(x + 6, y + 1);
      g.lineTo(x + 6 + dir * 3, y + ROW - 1);
      g.lineTo(x + dir * 3, y + ROW - 1);
      g.fill();
    }
    g.fillStyle = 'rgba(70,60,45,.28)';
    g.fillRect(0, y + ROW - 1, W, 1.2);
  }
  for (const x0 of [0, W - END]) {
    g.fillStyle = '#A9A091';
    g.fillRect(x0, 0, END, H);
    for (let y = 0; y < H; y += 3) {
      g.fillStyle = y % 6 ? 'rgba(255,250,240,.12)' : 'rgba(60,50,35,.15)';
      g.fillRect(x0, y, END, 1.5);
    }
  }
  speckle(g, W, H, 9000, 0.06);
  return canvasTexture(c, false);
}
