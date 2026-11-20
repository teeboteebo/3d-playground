# Bemz Sofa Fabrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search Bemz's NOCKEBY fabric range in the living-room panel and show the chosen fabric on the sofa as a real swatch texture, with its price and a link to the Bemz cover.

**Architecture:** A hand-run Node script captures the fabrics Bemz sells for the NOCKEBY cover into a committed data file. The app searches that list locally; the selected fabric is a new living setting. In the scene, the sofa's `Surf-Fabric` material gets its own triplanar-mapped material (world metres, mirrored repeat) that loads the swatch from `image.bemz.com` and shows the fabric's average colour until then or if loading fails.

**Tech Stack:** React 19, TypeScript, three.js 0.187, Vitest (jsdom), Playwright, Node 22 (script, no new dependencies).

**Spec:** `docs/superpowers/specs/2026-11-16-bemz-sofa-fabrics-design.md`

## Global Constraints

- Branch `bemz-sofa-fabrics` (already created from `main`), one PR.
- Settings `version` stays `2`; additive only. `living.sofaFabric` defaults to `'original'`; an unknown code falls back to `'original'`.
- Cover: `BEMZ_COVER = 'NOC6'` (NOCKEBY 3-seat with right chaise), one constant in the script; label "NOCKEBY 3-seat with chaise cover".
- Bemz URLs: product `https://bemz.com/sv-se/products/{COVER}-{CODE}`; swatch `https://image.bemz.com/productImage/{CODE}.jpg?v={stamp}&width={px}&q=85`. Scene texture width 1024; grid thumbnail width 160.
- Script: 0.5 s between requests; generic user agent (`Mozilla/5.0 (compatible; fabric-snapshot)`); no swatch images committed.
- Only the `Surf-Fabric` material changes; `_27`, `_1` (pillows) and `Paint-05` (legs) are untouched.
- Tile size: `scale` in metres per swatch tile; 0.25 for plain weaves, 0.6 for the families Flowers for a Home, Past Forward, The Reverie Collection.
- Prices shown as `6 999 kr`; a sale as `6 999 kr (sale 5 599 kr on 16 Nov 2026)`.
- Every task passes `npm run lint`, `npm run typecheck`, `npm test`. Before the PR also `npm run build`, `npm run test:e2e`, `npm run test:visual` (only the new baselines may be added; no existing one changes).
- Commit messages are plain sentences ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Repo style: single quotes, lines up to about 120 characters.

## Review Focus

1. Picking fabric A, then B before A's texture has arrived: the sofa ends on B, never A (Task 4 test).
2. Switching back to "Original" after a fabric: the sofa returns to exactly the model's colour with no map, and the replaced texture is disposed (Task 4 test).
3. The sofa still loading when a saved fabric is applied (fabric set before the model arrives): the fabric appears once it loads (Task 4 test).
4. A search with no matches, or one with only spaces: "No fabrics match" vs. the full list; the selected fabric's details stay visible even when it's filtered out of the grid (Task 3 test).
5. Hiding the sofa in the furniture list and showing it again keeps the chosen fabric (Task 4 test).

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/bemz-fabrics.mjs` (new) | capture fabrics, availability, prices and average colours from Bemz; write the data file |
| `scripts/bemzParse.mjs` (new) | pure parsers for Bemz page HTML, unit-tested |
| `src/data/bemzFabrics.ts` (new, generated) | `BemzFabric[]`, `BEMZ_COVER`, `BEMZ_CHECKED` |
| `src/data/fabrics.ts` (new) | `BemzFabric` type, `searchFabrics`, `fabricUrl`, `swatchUrl`, `fabricPrice` |
| `src/state/settings.ts` | `living.sofaFabric` |
| `src/components/SofaFabricSection.tsx` (new) | search box, swatch grid, selected fabric details |
| `src/components/LivingPanel.tsx` | mount the section after Lighting |
| `src/scene/sofaFabric.ts` (new) | triplanar fabric material, texture loading, apply/restore |
| `src/scene/furniture.ts` | hand the loaded sofa to the fabric module |
| `src/scene/createScene.ts` | apply the fabric; count its texture in `settled` |
| `src/styles.css` | swatch grid styles |
| `e2e/fixtures/fabric.png` (new), `e2e/visual.spec.ts` | fabric screenshot from a local fixture |

---

### Task 1: Fabric type, helpers and the capture script

**Files:**
- Create: `src/data/fabrics.ts`, `src/data/fabrics.test.ts`, `scripts/bemzParse.mjs`, `scripts/bemzParse.test.ts`, `scripts/bemz-fabrics.mjs`, `src/data/bemzFabrics.ts`
- Modify: `vite.config.ts` (only if Vitest's `include` doesn't already pick up `scripts/**/*.test.ts`), `README.md` (Structure: one line each for the script and data file; how to refresh)

**Interfaces:**
- Produces (`src/data/fabrics.ts`):
  ```ts
  export interface BemzFabric {
    code: string;          // 'RVM107'
    family: string;        // 'Recycled Velvet'
    colour: string;        // 'Dijon'
    tier: string;          // 'Premium' | … | '' when Bemz lists none
    hex: string;           // '#B08A3C', average swatch colour
    price: number;         // regular price in kr for BEMZ_COVER
    salePrice?: number;
    image: string;         // swatch URL without width/q, e.g. 'https://image.bemz.com/productImage/RVM107.jpg?v=202504050915'
    scale: number;         // metres per tile
  }
  export function searchFabrics(list: readonly BemzFabric[], query: string): BemzFabric[];
  export function swatchUrl(f: BemzFabric, width: number): string;
  export function fabricUrl(f: BemzFabric, cover?: string): string;   // defaults to BEMZ_COVER
  export function fabricPrice(f: BemzFabric, checked?: string): string; // defaults to BEMZ_CHECKED
  ```
- Produces (`src/data/bemzFabrics.ts`): `export const BEMZ_COVER = 'NOC6'; export const BEMZ_CHECKED = '16 Nov 2026'; export const BEMZ_FABRICS: BemzFabric[]` in Bemz's page order.
- Produces (`scripts/bemzParse.mjs`): `parseFabricList(html: string): {code, family, colour, tier, image}[]`, `parseProduct(html: string): {price: number, salePrice?: number} | null` (null when the page does not offer that fabric), `scaleFor(family: string): number`, `averagePngColour(png: Buffer): string`.

- [ ] **Step 1: Write failing tests for the helpers** in `src/data/fabrics.test.ts` with a two-fabric fixture list (`{code:'RVM107', family:'Recycled Velvet', colour:'Dijon', tier:'Premium', …}`, `{code:'BOU201', family:'Bouclé & textur', colour:'Snö', tier:'Luxe', …}`):
  - `searchFabrics(list, '')` and `searchFabrics(list, '   ')` return both, in order
  - `searchFabrics(list, 'velvet')` → `['RVM107']`; `'boucle'` → `['BOU201']` (accents ignored); `'rvm107'` → `['RVM107']`; `'luxe'` → `['BOU201']`; `'velvet dijon'` → `['RVM107']`; `'velvet snö'` → `[]`
  - `swatchUrl(f, 160)` === `f.image + '&width=160&q=85'`
  - `fabricUrl(f)` === `'https://bemz.com/sv-se/products/NOC6-RVM107'`
  - `fabricPrice({...f, price: 6999})` === `'6 999 kr'`; with `salePrice: 5599` and checked `'16 Nov 2026'` → `'6 999 kr (sale 5 599 kr on 16 Nov 2026)'`
  - Matching is on each word: every query word must appear in `family + colour + code + tier` (normalised with `normalize('NFD')`, diacritics stripped, lower case). Note that "Premium" contains no "luxe", but "Super Luxe" does: that's fine.

- [ ] **Step 2: Run** `npx vitest run src/data/fabrics.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Implement `src/data/fabrics.ts`** and a placeholder `src/data/bemzFabrics.ts` exporting the constants with an empty `BEMZ_FABRICS` (so the import resolves). Thousands separator is a regular space.

- [ ] **Step 4: Run** the test — expect PASS.

- [ ] **Step 5: Save parser fixtures.** Fetch `https://bemz.com/sv-se/fabrics` and `https://bemz.com/sv-se/products/NOC6-RVM107` once (curl with `-L` and the script's user agent) and trim each to the smallest HTML excerpt that still contains two fabrics' embedded data and the product's price data; save as `scripts/fixtures/fabrics.html` and `scripts/fixtures/product.html`. Also save a product page for a code Bemz doesn't offer for NOC6 (or a 404 body) as `scripts/fixtures/product-missing.html`. Data facts to rely on: the page is Next.js with escaped JSON in `<script>` pushes; fabrics carry `priceRange` (`"$undefined"` means none); swatch `<img src>` is `https://image.bemz.com/productImage/{CODE}.jpg?v=…`; product prices appear as `"price":{"unitPriceIncludingVat":6999…}`.

- [ ] **Step 6: Write failing parser tests** in `scripts/bemzParse.test.ts`: `parseFabricList(fixture)` returns the two fabrics with the expected code, family, colour, tier (`''` for `$undefined`) and image (with `v=`, without `width`/`q`); `parseProduct(product.html)` → `{ price: 6999 }`; `parseProduct(product-missing.html)` → `null`; `scaleFor('Flowers for a Home')` → `0.6`, `scaleFor('Linne')` → `0.25`.

- [ ] **Step 7: Run** `npx vitest run scripts/bemzParse.test.ts` — expect FAIL; then implement `scripts/bemzParse.mjs` (plain ESM with JSDoc types; regex/JSON extraction, no new dependency) and re-run — expect PASS. A sale shows as a lower current price next to a regular one in the price object; store the regular as `price`, the lower as `salePrice`.

- [ ] **Step 8: Implement `scripts/bemz-fabrics.mjs`**: fetch the list; for each fabric fetch its `NOC6` product page (0.5 s apart), drop it when `parseProduct` is null; fetch `{image}&width=8&format=png` (Bemz's image server returns `image/png` for `format=png`, checked 16 Nov) and set `hex` from `averagePngColour(buf)`, added to `scripts/bemzParse.mjs`: decode with `zlib.inflateSync` and undo the PNG row filters (types 0–4) for 8-bit RGB/RGBA, then average R, G, B in sRGB and return upper-case `#RRGGBB`. Test it in Step 6 with a fixture PNG saved from that URL (`scripts/fixtures/swatch.png`): the result matches `/^#[0-9A-F]{6}$/` and, for a hand-made 2 × 1 PNG of pure red and pure blue, equals `#800080` (rounding half up). Write `src/data/bemzFabrics.ts` with `BEMZ_CHECKED` as today's date (`'16 Nov 2026'` style) and a header comment saying it is generated by the script. Log counts: listed, kept, dropped.

- [ ] **Step 9: Run** `node scripts/bemz-fabrics.mjs` — expect it to log ~160 kept, and `src/data/bemzFabrics.ts` to typecheck (`npm run typecheck`). Spot-check two fabrics' prices against their product pages in a browser.

- [ ] **Step 10: Add a data test** to `src/data/fabrics.test.ts`: `BEMZ_FABRICS` has more than 100 entries, unique codes, every `hex` matches `/^#[0-9A-F]{6}$/`, every `price > 0`, every `image` starts with `https://image.bemz.com/productImage/`, every `scale` is 0.25 or 0.6. Run — expect PASS.

- [ ] **Step 11: Lint, typecheck, test; commit** "Capture Bemz's NOCKEBY fabrics and add fabric search helpers".

### Task 2: The `sofaFabric` setting

**Files:**
- Modify: `src/state/settings.ts`, `src/state/settings.test.ts`

**Interfaces:**
- Consumes: `BEMZ_FABRICS` (Task 1).
- Produces: `LivingSettings.sofaFabric: string` — `'original'` or a Bemz code; `DEFAULTS.living.sofaFabric === 'original'`.

- [ ] **Step 1: Write failing tests** in `settings.test.ts` (`describe('living room sofa fabric')`): default is `'original'`; a known code (`BEMZ_FABRICS[0].code`) is kept; `'XXX999'`, `42`, missing → `'original'`; the existing "old version-2 settings" test still deep-equals with the new default included.
- [ ] **Step 2: Run** `npx vitest run src/state/settings.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the field in `LivingSettings`, `DEFAULTS.living`, and `sanitizeLiving` via `oneOf(l.sofaFabric, ['original', ...BEMZ_FABRICS.map((f) => f.code)], 'original')`.
- [ ] **Step 4: Run** — expect PASS; then the whole suite (`npm test`), fixing any test that deep-equals living defaults.
- [ ] **Step 5: Commit** "Save the sofa's Bemz fabric with the living-room settings".

### Task 3: Sofa fabric panel section

**Files:**
- Create: `src/components/SofaFabricSection.tsx`
- Modify: `src/components/LivingPanel.tsx` (after `<LightingSection … />`), `src/components/App.test.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `searchFabrics`, `swatchUrl`, `fabricUrl`, `fabricPrice`, `BEMZ_FABRICS`, `BEMZ_CHECKED`, `living.sofaFabric`.
- Produces: `SofaFabricSection({ settings, update }: { settings: Settings; update: Update })`.

UI (follow existing section markup: `<section><h2>`):
```
Sofa fabric                       Bemz · checked 16 Nov 2026
[ Search fabric, colour or code…          ]      ← input type="search", aria-label "Search Bemz fabrics"
[Original][■][■][■][■][■] …                      ← role="group" aria-label "Sofa fabrics"; first 24 results, then "Show more" (+24)
Recycled Velvet, Dijon · RVM107 · Premium
NOCKEBY 3-seat with chaise cover · 6 999 kr · View on Bemz ↗
```
- Each swatch is a `<button aria-pressed>` with `aria-label="{family}, {colour}"` (Original: "Original fabric"); its `<img loading="lazy" src={swatchUrl(f,160)} alt="">` sits on `background: f.hex`.
- With `'original'` selected, the details line reads "The sofa's own dark grey" and no link.
- The details always show the selected fabric, even when the search hides it from the grid.
- Typing resets "Show more" to 24. Empty results: "No fabrics match" (the Original swatch stays).

- [ ] **Step 1: Write failing component tests** in `App.test.tsx` (`describe('sofa fabric')`, rendered with `renderIn('living')`):
  - typing `BEMZ_FABRICS[0].family` filters the grid so every remaining swatch label (except Original) contains that family
  - clicking a swatch sets `lastApplied().living.sofaFabric` to its code and `stored()` matches; that swatch has `aria-pressed="true"`
  - the details show `fabricPrice(f)` and a link with `href === fabricUrl(f)`, `target="_blank"`
  - typing `zzzz` shows "No fabrics match"; the details still show the selected fabric
  - the grid shows 24 fabric swatches + Original; clicking "Show more" shows 48 + Original
  - clicking Original sets `'original'` and the details read "The sofa's own dark grey"
- [ ] **Step 2: Run** `npx vitest run src/components/App.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** the section and mount it; add styles for a wrapping swatch grid (square tiles ~44 px, selected outline as other pickers use) to `styles.css`.
- [ ] **Step 4: Run** — expect PASS; lint, typecheck.
- [ ] **Step 5: Commit** "Search Bemz fabrics for the sofa in the living-room panel".

### Task 4: Triplanar fabric on the sofa

**Files:**
- Create: `src/scene/sofaFabric.ts`, `src/scene/sofaFabric.test.ts`
- Modify: `src/scene/furniture.ts` (expose the loaded sofa), `src/scene/createScene.ts` (apply; settled), `src/scene/furniture.test.ts` if the `Furniture` interface changes

**Interfaces:**
- Consumes: `BEMZ_FABRICS`, `swatchUrl`, `lin` (`src/scene/materials.ts`), `living.sofaFabric`.
- Produces:
  ```ts
  export interface SofaFabric {
    /** the sofa model has loaded: take over its Surf-Fabric material (call once) */
    attach(sofa: THREE.Object3D): void;
    /** 'original' or a Bemz code; safe before attach */
    set(code: string): void;
    /** false while a selected fabric's texture is loading */
    readonly settled: boolean;
    dispose(): void;
  }
  export function sofaFabric(
    onChange: () => void,
    load?: (url: string) => Promise<THREE.Texture>, // default: THREE.TextureLoader with crossOrigin 'anonymous'
  ): SofaFabric;
  export function triplanarWeights(normal: THREE.Vector3): THREE.Vector3; // |n|^4, normalised to sum 1
  ```
- `Furniture` gains `onLoaded(id: string, cb: (obj: THREE.Object3D) => void): void` (called at once if already loaded), or `loadFurniture` takes an `onPiece(id, obj)` callback — **decision:** add an optional fourth parameter `onPiece?: (id: string, obj: THREE.Object3D) => void` to `loadFurniture`, called after `parent.add(obj)`.

Material: on `attach`, find meshes whose material name is `Surf-Fabric`, clone that material once (keep the original colour as `originalColour`), assign the clone to those meshes. The clone's `onBeforeCompile` adds world position/normal varyings and replaces `#include <map_fragment>` with three samples of `map` at `vWorldPos.zy`, `vWorldPos.xz`, `vWorldPos.xy` divided by `uScale`, blended by `triplanarWeights` of the world normal (same formula in GLSL), multiplied into `diffuseColor`. Define `USE_MAP`-independent: set `material.map` so three includes the map uniforms, and set `customProgramCacheKey` to `'sofa-triplanar'`. The model has no UVs: the vertex shader must not require `uv` — guard by adding a zero `uv` attribute (`Float32Array(count*2)`) to the fabric geometry on attach. Texture: `colorSpace = SRGBColorSpace`, `wrapS = wrapT = MirroredRepeatWrapping`, `anisotropy = 8`. This must work with `applyLegacyLook` (it patches other chunks; `map_fragment` is untouched by it — assert in a test that `ShaderChunk.map_fragment` still contains the text being replaced, so an upgrade fails loudly).

Applying `set(code)`:
- `'original'`: colour = `originalColour`, `map = null`, dispose the old texture, `needsUpdate = true`.
- a code: colour = `lin(f.hex)`, `map = null` at once; then `load(swatchUrl(f, 1024))`; when it resolves and the code is still the current one, set `map`, colour white, `uScale = f.scale`, `needsUpdate`, dispose the previous texture, call `onChange()`. If a newer `set` happened meanwhile, dispose the late texture. On rejection: keep the colour, `console.warn` once per session.
- `settled` is true when no load is pending.
- `set` before `attach` stores the code and applies it on attach.

- [ ] **Step 1: Write failing tests** in `sofaFabric.test.ts`, with a fake sofa (a `Group` holding a mesh with a `MeshStandardMaterial({ name: 'Surf-Fabric', color: 0x2d2a27 })` and a mesh with material `_27`) and a controllable `load` (returns a deferred promise per call):
  - `triplanarWeights(new Vector3(0,1,0))` ≈ `(0,1,0)`; any normal's weights sum to 1
  - `attach` replaces only the Surf-Fabric material (the `_27` material is the same object as before)
  - `set(code)` sets the colour to `lin(f.hex)` before the load resolves and `settled` is false; after resolve, `map` is the texture, colour is white, `settled` true, `onChange` called
  - `set(A)`, `set(B)`, resolve B, then resolve A: `map` is B's texture and A's texture was disposed (spy on `dispose`)
  - `set('original')` after a fabric: colour equals the original, `map` null, the previous texture disposed
  - a rejected load leaves `lin(f.hex)`, `settled` true, one `console.warn`
  - `set(code)` before `attach`, then `attach`: the load starts and the fabric applies
  - `ShaderChunk.map_fragment` contains the string the patch replaces
- [ ] **Step 2: Run** `npx vitest run src/scene/sofaFabric.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `src/scene/sofaFabric.ts`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Wire it up.** Add the `onPiece` parameter to `loadFurniture` with a test in `furniture.test.ts` (called with `'sofa'` and the object after it's added; not called for a disposed load). In `createScene.ts`: create `const fabric = sofaFabric(invalidate)`, pass `(id, obj) => id === 'sofa' && fabric.attach(obj)` to `loadFurniture`, call `fabric.set(s.living.sofaFabric)` in `apply`, include `fabric.settled` in the `settled` flag, and `fabric.dispose()` in `dispose`. Add a `furniture.test.ts` case that `setHidden(['sofa'])` then `setHidden([])` does not touch the sofa's material.
- [ ] **Step 6: Run** `npm test`, lint, typecheck — expect PASS.
- [ ] **Step 7: Check by eye.** `npm run dev`, open the living room, pick a velvet, a linen, a bouclé and a print; check the weave has one scale across seat, back and arms, no hard breaks along the rounded arms, and tile edges aren't obvious. Tune the two `scale` values in `scripts/bemzParse.mjs` (`scaleFor`) if needed, re-run the script, and note the final values in the commit message.
- [ ] **Step 8: Commit** "Show the chosen Bemz fabric on the sofa as a triplanar texture".

### Task 5: Visual baseline and wrap-up

**Files:**
- Create: `e2e/fixtures/fabric.png` (a 256 × 256 generated test weave, not a Bemz image), `e2e/visual.spec.ts-snapshots/living-room-fabric-{day,eve}-darwin.png`
- Modify: `e2e/visual.spec.ts`, `README.md` (feature line: "in the living room, … and try Bemz fabrics on the sofa")

- [ ] **Step 1: Add the test** `Living room, with a Bemz fabric, ${time}` for day and eve: `page.route('https://image.bemz.com/**', (r) => r.fulfill({ path: 'e2e/fixtures/fabric.png', contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }))`, then `openWith(page, { room: 'living', time, living: { sofaFabric: BEMZ_FABRICS[0].code } })`, `settled`, screenshot `living-room-fabric-${time}.png`. Generate the fixture with a short Node script (stripes in two greys, stored as an uncompressed PNG) and commit only the image.
- [ ] **Step 2: Run** `npx playwright test e2e/visual.spec.ts --update-snapshots -g "Bemz fabric"`, look at both images (fabric visible on the sofa only, pillows and legs unchanged), then `npm run test:visual` — expect all other baselines unchanged.
- [ ] **Step 3: Run** `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` — expect all PASS.
- [ ] **Step 4: Commit** "Add a screenshot of the sofa in a Bemz fabric" and include the README line.
