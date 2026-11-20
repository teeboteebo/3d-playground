/*
 * Bemz's swatch photos show the cloth draped in soft diagonal folds. Tiled across a sofa, those folds would repeat as
 * a diamond pattern, so before a patterned fabric's swatch becomes a texture its shading is divided out, leaving the
 * print evenly lit at the swatch's own mean colour. (Plain fabrics don't use their photos at all, see fabricDetail.)
 */

/** fraction trimmed off each edge: the photos have a light border */
const CROP = 0.04;
/** the shading is estimated on a grid this many cells across ... */
const GRID = 128;
/** ... blurred by three box passes of this radius (in cells), about a gaussian of 1/50 of the image: the folds in
    Bemz's photos repeat every 1/5 or so of the image, so a coarser blur would leave them in */
const BLUR = 2;

export interface Pixels {
  /** RGBA, 8 bits per channel, sRGB */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const toLinear = new Float32Array(256).map((_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const ENCODE = 4096;
const toSRGB = new Uint8ClampedArray(ENCODE + 1).map((_, i) => {
  const c = i / ENCODE;
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
});

/** one box-blur pass along rows (step 1) or columns (step = gx) of a gx × gy grid, clamped at the edges */
function boxPass(src: Float32Array, gx: number, gy: number, alongRows: boolean): Float32Array<ArrayBuffer> {
  const out = new Float32Array(src.length);
  const [len, lines] = alongRows ? [gx, gy] : [gy, gx];
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < len; i++) {
      let s = 0;
      for (let k = -BLUR; k <= BLUR; k++) {
        const j = Math.min(len - 1, Math.max(0, i + k));
        s += src[alongRows ? line * gx + j : j * gx + line];
      }
      out[alongRows ? line * gx + i : i * gx + line] = s / (2 * BLUR + 1);
    }
  }
  return out;
}

/** divides the image's smooth shading out, in place, keeping each channel's mean (as the swatch's `hex` averages it) */
export function flattenPixels({ data, width, height }: Pixels): void {
  const n = width * height;
  const lin = new Float32Array(n * 3);
  const mean = [0, 0, 0];
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) {
      lin[p * 3 + c] = toLinear[data[p * 4 + c]];
      mean[c] += data[p * 4 + c] / n;
    }
  }

  /* the luminance averaged over a coarse grid, then blurred */
  const cell = Math.max(width, height) / GRID;
  const gx = Math.max(1, Math.round(width / cell));
  const gy = Math.max(1, Math.round(height / cell));
  let grid = new Float32Array(gx * gy);
  const count = new Float32Array(gx * gy);
  for (let y = 0; y < height; y++) {
    const cy = Math.min(gy - 1, Math.floor((y * gy) / height));
    for (let x = 0; x < width; x++) {
      const g = cy * gx + Math.min(gx - 1, Math.floor((x * gx) / width));
      const p = (y * width + x) * 3;
      grid[g] += 0.2126 * lin[p] + 0.7152 * lin[p + 1] + 0.0722 * lin[p + 2];
      count[g]++;
    }
  }
  for (let g = 0; g < grid.length; g++) grid[g] /= count[g] || 1;
  for (let pass = 0; pass < 3; pass++) grid = boxPass(boxPass(grid, gx, gy, true), gx, gy, false);

  /* each pixel divided by the bilinearly sampled shading */
  const out = new Float32Array(n * 3);
  for (let y = 0; y < height; y++) {
    const fy = Math.min(gy - 1, Math.max(0, ((y + 0.5) * gy) / height - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(gy - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(gx - 1, Math.max(0, ((x + 0.5) * gx) / width - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(gx - 1, x0 + 1);
      const tx = fx - x0;
      const top = grid[y0 * gx + x0] * (1 - tx) + grid[y0 * gx + x1] * tx;
      const bottom = grid[y1 * gx + x0] * (1 - tx) + grid[y1 * gx + x1] * tx;
      const shade = Math.max(1e-4, top * (1 - ty) + bottom * ty);
      const p = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) {
        out[p + c] = lin[p + c] / shade;
      }
    }
  }

  /* a gain per channel that brings the mean back to the original's: evening out the shading raises the mean of the
     sRGB values (the darks were compressed), so the gain is refined over a few passes */
  const gain = [1, 1, 1];
  const encode = (p: number, c: number) => toSRGB[Math.min(ENCODE, Math.round(out[p * 3 + c] * gain[c] * ENCODE))];
  for (let pass = 0; pass < 4; pass++) {
    const got = [0, 0, 0];
    for (let p = 0; p < n; p++) for (let c = 0; c < 3; c++) got[c] += encode(p, c) / n;
    for (let c = 0; c < 3; c++) gain[c] *= got[c] > 0 ? (mean[c] / got[c]) ** 2.2 : 0;
  }
  for (let p = 0; p < n; p++) for (let c = 0; c < 3; c++) data[p * 4 + c] = encode(p, c);
}

/** the swatch photo, trimmed and evenly lit, ready to tile (see flattenPixels) */
export function flattenSwatch(img: HTMLImageElement): HTMLCanvasElement {
  const sx = Math.round(img.naturalWidth * CROP);
  const sy = Math.round(img.naturalHeight * CROP);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth - 2 * sx;
  canvas.height = img.naturalHeight - 2 * sy;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  flattenPixels(pixels);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
