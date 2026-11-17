import { describe, expect, it } from 'vitest';
import { flattenPixels } from './flattenSwatch';

/* four pixels to a shading cell, as a 1024-pixel swatch has eight */
const N = 512;

/** a warm cloth colour, darkened by a smooth fold from left to right, with a fine ±12% weave on top */
function foldedWeave() {
  const data = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const shade = 0.45 + 0.55 * (x / (N - 1));
      const weave = (x + y) % 2 ? 1.12 : 0.88;
      const i = (y * N + x) * 4;
      data[i] = 200 * shade * weave;
      data[i + 1] = 170 * shade * weave;
      data[i + 2] = 140 * shade * weave;
      data[i + 3] = 255;
    }
  }
  return { data, width: N, height: N };
}

const meanOf = (d: Uint8ClampedArray, c: number) => {
  let s = 0;
  for (let i = c; i < d.length; i += 4) s += d[i];
  return s / (d.length / 4);
};

/** the mean green value of the columns x0..x1 */
const band = (d: Uint8ClampedArray, x0: number, x1: number) => {
  let s = 0;
  let n = 0;
  for (let y = 0; y < N; y++) for (let x = x0; x < x1; x++, n++) s += d[(y * N + x) * 4 + 1];
  return s / n;
};

describe('flattenPixels', () => {
  it('evens out a smooth fold but keeps the weave and the mean colour', () => {
    const img = foldedWeave();
    const before = Uint8ClampedArray.from(img.data);
    flattenPixels(img);
    const ratio = (d: Uint8ClampedArray) => band(d, N * 0.75, N) / band(d, 0, N * 0.25);
    expect(ratio(before)).toBeGreaterThan(1.7);
    expect(ratio(img.data)).toBeLessThan(1.15);
    for (const c of [0, 1, 2]) expect(meanOf(img.data, c)).toBeCloseTo(meanOf(before, c), -0.5);
    // neighbouring pixels still differ by the weave
    const i = (N / 2) * N * 4 + (N / 2) * 4;
    expect(Math.abs(img.data[i + 1] - img.data[i + 5])).toBeGreaterThan(20);
    expect(img.data[i + 3]).toBe(255);
  });

  it('leaves an evenly lit image as it was', () => {
    const img = foldedWeave();
    for (let i = 0; i < img.data.length; i += 4) {
      const weave = img.data[i + 3] && ((i / 4) % 2 ? 1.1 : 0.9);
      [img.data[i], img.data[i + 1], img.data[i + 2]] = [150 * weave, 120 * weave, 100 * weave];
    }
    const before = Uint8ClampedArray.from(img.data);
    flattenPixels(img);
    let worst = 0;
    for (let i = 0; i < before.length; i++) worst = Math.max(worst, Math.abs(before[i] - img.data[i]));
    expect(worst).toBeLessThanOrEqual(3);
  });
});
