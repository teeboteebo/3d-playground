// Parsing helpers for scripts/bemz-fabrics.mjs: Bemz's pages are Next.js pages with escaped JSON in <script> pushes.
import { inflateSync } from 'node:zlib';

/** Undo the string escaping of the Next.js payload so keys and values can be matched as plain JSON text. */
const unescapePage = (html) => html.replace(/\\"/g, '"').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');

/**
 * Tile size in metres for pattern fabrics (plain kinds use their own detail scale): the printed collections have
 * large repeats, other prints (stripes, checks) are small.
 * @param {string} family
 * @returns {number}
 */
export function scaleFor(family) {
  return /flowers for a home|past forward|the reverie collection/i.test(family) ? 0.6 : 0.25;
}

const COLLECTIONS = {
  'FLOWERS FOR A HOME': 'Flowers for a Home',
  'PAST FORWARD COLLECTION': 'Past Forward',
  'THE REVERIE COLLECTION': 'The Reverie Collection',
};

/**
 * Every fabric on the /fabrics page, in the order the grid shows them.
 * `family` is Bemz's fabric name ('Recycled Velvet'); fabrics in one of the printed collections get the collection in
 * brackets, e.g. 'Satin Stripe (Flowers for a Home)', so it can be searched and so scaleFor can see it.
 * @param {string} html
 * @returns {{code: string, family: string, colour: string, tier: string, image: string}[]}
 */
export function parseFabricList(html) {
  const text = unescapePage(html);
  const records = new Map();
  const starts = [...text.matchAll(/"([A-Z0-9]+)":\{"fabricId":"\1"/g)];
  starts.forEach((m, i) => {
    const end = starts[i + 1]?.index ?? text.indexOf('</script>', m.index);
    const body = text.slice(m.index, end === -1 ? undefined : end);
    const str = (key) => body.match(new RegExp(`"${key}":"([^"]*)"`))?.[1];
    const categories = [...(body.match(/"categories":\[(.*?)\],"fabricTitle"/)?.[1] ?? '').matchAll(/"name":"([^"]*)"/g)].map(
      (c) => c[1].trim(),
    );
    records.set(m[1], {
      name: (str('name') ?? '').trim(),
      colour: (str('fabricColorName') ?? str('fabricTitle')?.split(' - ').slice(1).join(' - ') ?? '').trim(),
      tier: str('priceRange'),
      collection: COLLECTIONS[categories.map((c) => c.toUpperCase()).find((c) => c in COLLECTIONS)],
    });
  });
  const result = [];
  const seen = new Set();
  for (const m of text.matchAll(/<img [^>]*?src="(https:\/\/image\.bemz\.com\/productImage\/([A-Z0-9]+)\.jpg\?v=(\d+))/g)) {
    const [, src, code] = m;
    const r = records.get(code);
    if (seen.has(code) || !r) continue;
    seen.add(code);
    const family = r.collection && r.name ? `${r.name} (${r.collection})` : r.name;
    if (!family || !r.colour || !src) throw new Error(`fabric ${code}: missing family or colour; has the page changed?`);
    result.push({ code, family, colour: r.colour, tier: !r.tier || r.tier === '$undefined' ? '' : r.tier, image: src });
  }
  return result;
}

/**
 * The price of the product page's own fabric. Bemz redirects unknown fabrics to a default variant, so pass the
 * article number you asked for ('NOC6-RVM107'): when the page is for another one, the fabric isn't offered.
 * @param {string} html
 * @param {string} articleNumber
 * @returns {{price: number, salePrice?: number} | null}
 */
export function parseProduct(html, articleNumber) {
  const text = unescapePage(html);
  const m = text.match(/"__typename":"CoverProduct","articleNumber":"([^"]+)".*?"price":\{"unitPriceIncludingVat":([\d.]+),"unitPriceExcludingVat":[\d.]+,"discountPriceIncludingVat":(null|[\d.]+)/s);
  if (!m || m[1] !== articleNumber) return null;
  const price = Math.round(Number(m[2]));
  const sale = m[3] === 'null' ? undefined : Math.round(Number(m[3]));
  return sale !== undefined && sale < price ? { price, salePrice: sale } : { price };
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * Average colour of an 8-bit RGB or RGBA PNG, averaged in sRGB, as '#RRGGBB'.
 * @param {Buffer} png
 * @returns {string}
 */
export function averagePngColour(png) {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  for (let pos = 8; pos < png.length; ) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colourType = data[9];
      if (depth !== 8 || (colourType !== 2 && colourType !== 6) || data[12] !== 0) {
        throw new Error(`unsupported PNG (depth ${depth}, colour type ${colourType}, interlace ${data[12]})`);
      }
      channels = colourType === 2 ? 3 : 4;
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = [];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = prev[i];
      const upLeft = i >= channels ? prev[i - channels] : 0;
      const add = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      if (add === undefined) throw new Error(`bad PNG filter ${filter}`);
      row[i] = (row[i] + add) & 255;
    }
    rows.push(row);
    prev = row;
  }
  const sums = [0, 0, 0];
  for (const row of rows) for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) sums[c] += row[x * channels + c];
  const n = width * height;
  return '#' + sums.map((s) => Math.round(s / n).toString(16).padStart(2, '0')).join('').toUpperCase();
}
