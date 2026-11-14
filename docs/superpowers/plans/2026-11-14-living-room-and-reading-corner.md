# Living Room Adjustments and Office Reading Corner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the living room as now settled (lamp beside the plant, no lounge chairs or side table, half-height String columns) with configurable wall moulding, and give the office a reading corner whose chair, dresser and round rug are chosen from real products.

**Architecture:** Living-room changes edit the furniture catalog and lamp spot, trim the loaded shelving geometry with a pure clipping function, and add a living moulding module built on a generalised version of the bedroom's three-column layout, mounted on the apartment's walls so it hides with them. The reading corner adds three product lists with drawable shapes (like the lamps), three office settings, and an office module that builds the chosen pieces.

**Tech Stack:** React 19, TypeScript, three.js 0.187, Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-living-room-and-reading-corner-design.md`

## Global Constraints

- Two PRs: Tasks 1–6 (living room) on `feature/living-room-adjustments`; Tasks 7–11 (office) on a new branch from `main` after the first merges.
- Settings `version` stays `2`; changes are additive. Designs saved before this change get the new defaults (moulding on both living walls; first chair, dresser and rug), and an explicit `'none'` gives no corner piece.
- No new model files; new things are drawn in code. The String shelving is trimmed from the existing model.
- Scene coordinates are metres; x east, floor y = 0, ceiling `CEILING` = 3.3.
- Living moulding: rail at 0.75 m; low frames 0.28–0.67 m; high frames 0.83–3.0 m; frame strip `FRAME_T` = 0.028; strips 9–14 mm proud; colour `'white'` = trim, `'tone'` = living wall paint × 0.82.
- Moulding layout: sofa wall z = −1.925, centre x 5.855, half-span 1.8; TV wall z = 2.725 (x 3.69–7.376), centre x 5.58, half-span 1.75, centre column never narrower than 1.66 m.
- Sliders keep the bedroom's ranges (`SLIDERS`); defaults gap 8, centre 180, side 68; colour `'white'`; both walls `'on'`.
- Corner products: dressers ≤ 110 cm wide; round rugs 160–200 cm across; every product has vendor, price, stock, https url and a shape; one `CORNER_CHECKED` date.
- Every PR passes `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm run test:visual` locally (set `PW_PORT` if 5199 is busy). Re-record only the baselines a PR is meant to change.
- Commit messages are plain sentences and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Repo style: single quotes, lines up to about 120 characters.

## Review Focus

1. A saved design whose `living.hidden` lists `armchairs` or `side-table`: it loads without them and the furniture list still works (Task 1 test).
2. The moulding colour set to "wall colour" and the living-room paint then changed: the moulding follows the new paint (Task 4 test).
3. Switching reading-corner products back and forth: the old piece's geometry and materials are freed and only one of each piece is ever in the scene (Task 9 test).
4. Every round rug in the catalog, not just the default, fits inside the office and clear of desk and cabinets (Task 9 test).
5. Turning a living-room piece on and off in the furniture list after the shelving was trimmed: the shelving still hides and shows (Task 2 test).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/catalog.ts` | furniture list (minus two pieces), `Sofa wall` view, corner product lists |
| `src/scene/roomLamps.ts` | living floor-lamp spot |
| `src/scene/trimGeometry.ts` (new) | clip a geometry above a height inside a region |
| `src/scene/furniture.ts` | apply the trim to the shelving when it loads |
| `src/scene/layout.ts` | `wallLayout` with a half-span and minimum centre |
| `src/scene/livingMoulding.ts` (new) | living sofa-wall and TV-wall moulding |
| `src/scene/buildApartment.ts` | `attachToWall` so extra parts hide with a wall |
| `src/state/settings.ts` | living moulding fields; office corner fields |
| `src/components/MouldingSection.tsx` | generalised for bedroom and living room |
| `src/scene/canvas.ts` | round rug patterns and thumbnails |
| `src/scene/office/corner.ts` (new) | reading chair, dresser and round rug |
| `src/scene/office/dimensions.ts` | corner placement constants |
| `src/components/OfficePanel.tsx` | "Reading corner" section |

---

# PR A: Living room

### Task 1: Remove the lounge chairs and side table, move the floor lamp

**Files:**
- Modify: `src/data/catalog.ts` (`FURNITURE`), `src/scene/roomLamps.ts` (`FLOOR_LAMP_SPOT.living` and its comment)
- Delete: `public/models/living/armchairs.glb`, `public/models/living/side-table.glb`
- Modify: the "as built" notes in `docs/superpowers/specs/2026-11-13-office-furniture-and-lamps-design.md` and `docs/superpowers/plans/2026-11-13-office-furniture-and-lamps.md` that state the old living spot — add one line each: "Moved on 14 Nov 2026 to `{ x: 7.6, z: -1.2, rotY: Math.PI }`, beside the plant (see the 2026-11-14 design)."
- Test: `src/state/settings.test.ts`, `src/scene/roomLamps.test.ts`

**Interfaces — Produces:** `FURNITURE` without ids `armchairs`, `side-table`; `FLOOR_LAMP_SPOT.living = { x: 7.6, z: -1.2, rotY: Math.PI }`.

- [ ] **Step 1: Write the failing tests**

```ts
// settings.test.ts
it('drops removed living-room furniture from saved hidden lists', () => {
  const s = sanitizeSettings({ version: 2, living: { hidden: ['armchairs', 'side-table', 'sofa'] } });
  expect(s.living.hidden).toEqual(['sofa']);
});
// roomLamps.test.ts — replace the living-room sofa/shelving clearance test
it('stands the living floor lamp between the sofa and the plant pot', () => {
  const g = new THREE.Group();
  addRoomLamps(g).apply({ ...DEFAULTS, living: { ...DEFAULTS.living, floorLamp: 'kona' } });
  g.updateMatrixWorld(true);
  /* every vertex of the lamp's shadow-casting parts below 0.6 m stays between the sofa (x 7.24) and the pot (x 7.96) */
  // collect as in the existing tripod test; then:
  expect(minX).toBeGreaterThan(7.24);
  expect(maxX).toBeLessThan(7.96);
});
```

- [ ] **Step 2: Run** `npx vitest run src/state src/scene/roomLamps.test.ts` — expected: both fail.
- [ ] **Step 3: Implement.** Comment for the spot: between the sofa's east end (7.24) and the plant pot (7.96); `rotY: π` points an arc lamp's reach back over the sofa; a shade stands among the plant's leaves.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — expected: pass.
- [ ] **Step 5: Commit** — "Take out the lounge chairs and side table, and stand the floor lamp beside the plant".

### Task 2: Cut the String shelving's two left columns to half height

**Files:**
- Create: `src/scene/trimGeometry.ts`, `src/scene/trimGeometry.test.ts`
- Modify: `src/scene/furniture.ts` (apply to the `shelving` piece), `src/data/catalog.ts` (a `SHELVING_CUT` constant or beside the furniture list)
- Test: `src/scene/furniture.test.ts`

**Interfaces — Produces:**
```ts
/** Keeps what lies below `y` (world space) inside `inRegion`, clipping triangles that cross it; leaves everything
 *  else as it is. Returns a new non-indexed geometry with position, normal and uv (when present) as float attributes. */
export function trimAbove(
  geometry: THREE.BufferGeometry,
  matrixWorld: THREE.Matrix4,
  y: number,
  inRegion: (world: THREE.Vector3) => boolean,
): THREE.BufferGeometry
export const SHELVING_CUT: { zFrom: number; y: number }   // in catalog.ts, values found in Step 3
```
A triangle is "in the region" when all three of its world-space vertices pass `inRegion`. In-region triangles: all vertices below → keep; all above → drop; straddling → clip against the plane (Sutherland–Hodgman on one plane gives 3 or 4 vertices → 1 or 2 triangles), interpolating every attribute with the same t. Read attributes with `fromBufferAttribute` so normalised/quantised attributes decode correctly. The world matrix is affine, so interpolating local attributes with t from world y is exact.

- [ ] **Step 1: Write the failing tests** (`trimGeometry.test.ts`, on hand-made geometry with identity matrix unless stated)

```ts
it('keeps a triangle below the cut and drops one above it', () => { /* two triangles; expect 1 triangle out */ });
it('clips a straddling triangle so its part below the cut stays', () => {
  // triangle (0,0,0) (1,0,0) (0,2,0), cut at y = 1, region all
  // expect: max y of output === 1 (±1e-6), output area === area of the clipped polygon (0.75)
});
it('leaves triangles outside the region untouched, even above the cut', () => { /* region z > 0; triangle at z = -1 above cut stays */ });
it('applies the cut in world space', () => { /* matrix with translation y = 0.5 and scale 2; cut at y = 1.5 keeps local y ≤ 0.5 */ });
it('interpolates normals and uvs at the cut', () => { /* uv v goes 0→1 along y; the new vertex at the cut has v = 0.5 */ });
// furniture.test.ts
it('trims the shelving when it loads and keeps it toggleable', async () => {
  // load a fake shelving piece (a tall box mesh spanning z −1.8…0.6, y 0…2) through loadFurniture;
  // expect: no vertex with z > SHELVING_CUT.zFrom has y > SHELVING_CUT.y + 1e-6; vertices with z < zFrom still reach y 2;
  // setHidden(['shelving']) hides it, setHidden([]) shows it
});
```

- [ ] **Step 2: Run** `npx vitest run src/scene/trimGeometry.test.ts src/scene/furniture.test.ts` — expected: fail.
- [ ] **Step 3: Find the cut values.** From `public/models/living/shelving.glb` (decode in Node with three's `GLTFLoader` + `MeshoptDecoder`, or read the decoded geometry in a test), list the y of the top faces of the wooden shelves (material "string furniture hout") in the columns at z > −1.01. Set `SHELVING_CUT.y` = 1 cm above the top of the shelf nearest 1.0 m, and `SHELVING_CUT.zFrom` = the z of the ladder between the full-height column and the cut ones plus its half-width, so that shared ladder stays full height (about −0.99; read it from the black aluminium parts). Record the values found in a comment.
- [ ] **Step 4: Implement** `trimAbove` and, in `loadFurniture`, replace each mesh's geometry under the `shelving` piece with the trimmed one (dispose the old geometry) before the piece is added.
- [ ] **Step 5: Run** `npm test && npm run lint && npm run typecheck` — expected: pass.
- [ ] **Step 6: Commit** — "Cut the String shelving's two left columns to half height".

### Task 3: Living moulding settings and a general wall layout

**Files:**
- Modify: `src/state/settings.ts`, `src/scene/layout.ts`
- Test: `src/state/settings.test.ts`, `src/scene/layout.test.ts`

**Interfaces — Produces:**
```ts
// settings.ts
export interface MouldLayout { mouldGap: number; mouldCentre: number; mouldSide: number }
export interface LivingSettings extends LampSettings, MouldLayout {
  hidden: string[];
  mouldColour: 'white' | 'tone';
  mouldSofaWall: OnOff;
  mouldTvWall: OnOff;
}
// layout.ts
export interface WallLayout { centreHalf: number; gap: number; sideWidth: number; columns: [number, number][] }
/** three columns relative to the centre line; centre column at least `minCentre` m wide */
export function wallLayout(mcenCm: number, mgapCm: number, mswCm: number, halfSpan: number, minCentre = 0): WallLayout
```
`bedWallLayout` keeps its signature and result (it calls `wallLayout(…, 1.84)` and adds `tableOffset`). Living fields are sanitised like the bedroom's (`oneOf`, `onOff`, `num` with `SLIDERS`). Defaults per Global Constraints.

- [ ] **Step 1: Write the failing tests**

```ts
it('gives the living room moulding defaults, also to designs saved before it existed', () => {
  const s = sanitizeSettings({ version: 2, living: { hidden: [] } });
  expect(s.living).toMatchObject({ mouldColour: 'white', mouldSofaWall: 'on', mouldTvWall: 'on', mouldGap: 8, mouldCentre: 180, mouldSide: 68 });
});
it('clamps living moulding sizes to the slider ranges', () => {
  expect(sanitizeSettings({ version: 2, living: { mouldCentre: 999, mouldGap: -3 } }).living).toMatchObject({ mouldCentre: 200, mouldGap: 4 });
});
it('keeps the bed-wall layout as it was', () => { expect(bedWallLayout(180, 8, 68)).toEqual(/* value computed by the current code, pasted in */); });
it('widens the centre column to the minimum', () => {
  const l = wallLayout(150, 8, 68, 1.75, 1.66);
  expect(l.centreHalf).toBeCloseTo(0.83);
  expect(l.columns[2][1]).toBeLessThanOrEqual(1.75 + 1e-9);
});
```

- [ ] **Step 2: Run** `npx vitest run src/state src/scene/layout.test.ts` — expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck` — expected: pass.
- [ ] **Step 5: Commit** — "Save living-room moulding settings, and let the moulding layout fit any wall".

### Task 4: Living moulding in the scene

**Files:**
- Create: `src/scene/livingMoulding.ts`, `src/scene/livingMoulding.test.ts`
- Modify: `src/scene/buildApartment.ts` (`attachToWall`), `src/scene/createScene.ts`

**Interfaces:**
- Consumes: `wallLayout` (Task 3), `LivingSettings` moulding fields, `TRIM`, `PAINTS`, `findById`, `lin`, `mergeMeshes`, `kit`.
- Produces:
  ```ts
  // buildApartment.ts — Apartment gains:
  /** hide `parts` with the wall of `room` whose line passes within 2 cm of `onWall` */
  attachToWall(room: RoomId, onWall: XZ, parts: THREE.Object3D[]): void
  // livingMoulding.ts
  export interface LivingMoulding { apply(s: Settings): void; dispose(): void }
  export function buildLivingMoulding(parent: THREE.Object3D, attach: (onWall: XZ, parts: THREE.Object3D[]) => void): LivingMoulding
  ```
  One material per wall, named `living-mould-sofa` and `living-mould-tv`. `apply` rebuilds a wall's strips only when its layout changes (as `bedWallMoulding` does), shows/hides each wall from its on/off setting, sets colours, and re-attaches rebuilt parts. Sofa wall strips face +z at z = −1.925; TV wall strips face −z at z = 2.725; the rail spans each wall (sofa x 3.69–8.69, TV x 3.69–7.376).

- [ ] **Step 1: Write the failing tests**

```ts
it('builds three columns and a rail on each wall, inside the wall', () => { /* boxes of each material within x extents, y 0.28–3.0, |z − wallZ| ≤ 0.015 */ });
it('keeps the TV-wall moulding off the TV at the narrowest centre width', () => {
  // apply mouldCentre 150; no strip of living-mould-tv intersects the box x 4.85–6.31, y 1.0–1.83
});
it('follows the wall paint in tone mode', () => {
  // apply mouldColour 'tone' with walls.living = 'linen' then 'stone'; material colour === lin(paint) × 0.82 each time
});
it('hides a wall that is switched off', () => { /* mouldTvWall 'off' → every living-mould-tv mesh invisible */ });
it('rebuilds only when the layout changes', () => { /* same settings twice → same mesh objects */ });
```

- [ ] **Step 2: Run** `npx vitest run src/scene/livingMoulding.test.ts` — expected: fail.
- [ ] **Step 3: Implement**; wire into `createScene.ts` after `buildApartment` (`attach` = `(p, parts) => apartment.attachToWall('living', p, parts)`), `apply`, `dispose`. In `attachToWall`, merge nothing; just add the parts to that wall's hidden set used by `showFrom` (and replace previously attached parts for the same wall and caller).
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck && npm run build` — expected: pass.
- [ ] **Step 5: Commit** — "Add wall moulding to the living room's sofa and TV walls".

### Task 5: Moulding controls for the living room, and a Sofa wall view

**Files:**
- Modify: `src/components/MouldingSection.tsx`, `src/components/BedroomPanel.tsx`, `src/components/LivingPanel.tsx`, `src/data/catalog.ts` (`VIEWS`)
- Test: `src/components/App.test.tsx`

**Interfaces — Produces:**
```ts
export function MouldingSection(props: {
  room: 'bedroom' | 'living';
  walls: readonly { key: string; label: string }[];   // living: mouldSofaWall 'Sofa wall', mouldTvWall 'TV wall'
  layoutLabel: string;                                // bedroom 'Bed wall layout', living 'Layout'
  settings: Settings; update: Update;
}): JSX.Element
// VIEWS gains, after 'Living room':
{ name: 'Sofa wall', icon: 'sofa', room: 'living', pose: { theta: 0, phi: 1.33, dist: 9.5, tx: 6.2, ty: 1.05, tz: 0.3 } }
```
Sliders are disabled when every listed wall is off (the bedroom's behaviour is unchanged: it lists only the bed wall for that rule — keep its `data-testid="bed-wall-layout"`). The living section sits after Lighting.

- [ ] **Step 1: Write the failing tests**

```ts
it('changes the living-room moulding', async () => {
  await renderIn('living');
  await userEvent.click(within(screen.getByRole('group', { name: 'Show moulding on' })).getByRole('button', { name: /TV wall/ }));
  expect(lastApplied().living.mouldTvWall).toBe('off');
  // slider: fireEvent.change on the 'Centre width' slider to 160 → lastApplied().living.mouldCentre === 160
});
it('greys out the living layout only when both walls are off', async () => { /* off one: enabled; off both: disabled */ });
it('offers the Sofa wall view in the living room', async () => { await renderIn('living'); expect(viewNames()).toContain('Sofa wall'); });
```
Existing bedroom moulding tests must pass unchanged.

- [ ] **Step 2: Run** `npx vitest run src/components` — expected: fail.
- [ ] **Step 3: Implement.** Point the Sofa wall view at the sofa so its moulding shows; adjust `phi`/`dist` if needed during Task 6's render check.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — expected: pass.
- [ ] **Step 5: Commit** — "Add living-room moulding controls and a Sofa wall view".

### Task 6: Render check, baselines, PR A (controller)

- [ ] **Step 1:** Render the living room by day and evening from the Living room and Sofa wall views and from above the shelving; check the lamp beside the plant, the gone chairs and table, the shelving cut (no holes, no floating parts, the shared ladder full height), and the moulding on both walls clear of the TV. Show the owner; apply corrections in constants.
- [ ] **Step 2:** `npm run test:visual`: expected failures only in Living room, Apartment and their customised variants, plus new Sofa wall baselines; any other failure is a bug.
- [ ] **Step 3:** Re-record those baselines only, update README (`livingMoulding.ts`, `trimGeometry.ts`, furniture list), run the full check list, commit — "Refresh the living-room screenshots".
- [ ] **Step 4:** Whole-branch review, fix wave, file the PR, merge on the owner's yes.

---

# PR B: Office reading corner

## As built (living room, PR A)

- A shelving triangle counts as in a cut region when ANY corner is in it. With "all corners", boards ending inside the
  shared ladder floated above the cut.
- `SHELVING_CUT` is a list of `{ zFrom, zTo, y }` regions. The middle column has `y` 1.053 and ends at the shared
  ladder's +z face (-0.199). The leftmost column has `y` 1.02, below the old glass-cabinet floor. A 2-3 cm stub of that
  board is left inside the shared ladder (accepted).
- The sofa wall is a grid (`mouldSofaColumns` 2-10, default 5; `mouldSofaGap` 4-30 cm, default 8, also the end margin)
  built with `gridLayout`. The three-column layout with the centre/side/gap sliders applies to the TV wall only.
- `MouldingSection` takes `layouts` groups instead of `layoutLabel`.
- The Sofa wall view's pose is `{ theta: 0, phi: 1.08, dist: 9.0, tx: 6.0, ty: 0.9, tz: -0.6 }` (looking over the TV).
- The Hall, Wardrobe wall and Office screenshots were re-recorded too, because they look through doorways into the
  living room.

### Task 7: Reading-corner products

**Files:**
- Modify: `src/data/catalog.ts`, `src/scene/canvas.ts`
- Test: `src/data/catalog.test.ts`, `src/scene/canvas.test.ts` (create if absent)

**Interfaces — Produces:**
```ts
export interface ArmchairShape { w: number; d: number; h: number; seatH: number; colour: string; legColour: string; wings: boolean }
export interface DresserShape { w: number; d: number; h: number; drawers: number; colour: string; legH: number }
export interface RoundRugShape { d: number; pattern: string; edge: string }
export interface ShopItem<S> { id: string; name: string; vendor: string; price: string; stock: string; st: StockState; url: string; shape: S | null }
export const READING_CHAIRS: ShopItem<ArmchairShape>[];   // 'none' first, then 3–4
export const DRESSERS: ShopItem<DresserShape>[];          // 'none' first, then 3–4, w ≤ 1.1
export const ROUND_RUGS: ShopItem<RoundRugShape>[];       // 'none' first, then 3–4, d 1.6–2.0
export const CORNER_CHECKED: string;                     // e.g. '14 Nov 2026'
// canvas.ts
export function getRoundRugCanvases(): Record<string, HTMLCanvasElement>   // keyed by pattern
export function roundRugThumbnail(pattern: string): string
```
Products: real ones from Swedish shops found by web search, spanning cheap to premium, sizes from the listing, estimates commented, never an invented price or URL. Each rug's `pattern` is a procedural drawing (in the style of the existing rug patterns) that resembles the product; draw it in a square canvas with the design centred, as it is mapped onto a disc.

- [ ] **Step 1: Write the failing tests** — for each list: `'none'` first, unique ids, ≥ 4 entries, every product has vendor, price, https url, non-null shape; every dresser `w ≤ 1.1`; every rug `1.6 ≤ d ≤ 2.0` and a pattern that `getRoundRugCanvases()` draws (skip the canvas check when the 2D context is unavailable, as the existing rug tests do).
- [ ] **Step 2: Run** `npx vitest run src/data src/scene/canvas.test.ts` — expected: fail.
- [ ] **Step 3: Research and implement.**
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — expected: pass.
- [ ] **Step 5: Commit** — "Add reading chairs, dressers and round rugs to choose from".

### Task 8: Reading-corner settings

**Files:** Modify `src/state/settings.ts`; Test `src/state/settings.test.ts`

**Interfaces — Produces:** `OfficeSettings extends LampSettings { readingChair: string; dresser: string; roundRug: string }`, `Settings.office: OfficeSettings`; defaults `READING_CHAIRS[1].id`, `DRESSERS[1].id`, `ROUND_RUGS[1].id`; a missing or unknown id sanitises to that default; `'none'` stays `'none'`; each id is checked only against its own list.

- [ ] **Step 1: Write the failing tests** — defaults; a saved office with only lamps gets the three defaults; `'none'` kept; an unknown id → default; a dresser id given as chair → chair default; `applyPatch({ office: { dresser: 'none' } })` keeps the other fields.
- [ ] **Step 2–4:** run red, implement, run `npm test && npm run typecheck` green.
- [ ] **Step 5: Commit** — "Save the reading corner's chair, dresser and rug".

### Task 9: Reading corner in the scene

**Files:**
- Create: `src/scene/office/corner.ts`, `src/scene/office/corner.test.ts`
- Modify: `src/scene/office/dimensions.ts`, `src/scene/office/index.ts` (build and apply the corner)

**Interfaces:**
- Consumes: Task 7 shapes and lists, Task 8 settings, `getRoundRugCanvases`, `canvasTexture` (`src/scene/textures.ts`).
- Produces:
  ```ts
  // dimensions.ts
  export const CORNER = {
    chair: { x: 11.2, z: 1.5, facing: -3 * Math.PI / 4 },  // facing: angle of the direction the seat faces, from +x towards +z
    dresserWall: { a: [8.89, 0.925], b: [9.63, 2.075], gap: 0.05 },  // dresser centred on this wall, back `gap` off it
    rug: { x: 10.35, windowZ: 2.075, gap: 0.05 },           // rug centre z = windowZ − gap − d/2
  } as const;
  // corner.ts
  export interface Corner { apply(s: Settings): void; dispose(): void }
  export function buildCorner(parent: THREE.Object3D): Corner
  ```
  Groups named `office-reading-chair`, `office-dresser`, `office-round-rug`. A piece is rebuilt only when its id changes; the replaced piece's geometries, materials and textures are disposed. The rug is a thin disc (about 1 cm) with the pattern on top and `edge` on its rim; it receives shadows and casts none. Chair and dresser cast and receive shadows.

- [ ] **Step 1: Write the failing tests**

```ts
it.each(ROUND_RUGS.slice(1).map((r) => [r.id]))('fits rug %s inside the office, clear of desk and cabinets', (id) => {
  // build with that rug; every rim point (sample 64) is inside the office outline (roomAt === 'office')
  // and its box does not intersect the office-desk or office-cabinets boxes (build the office too)
});
it.each(READING_CHAIRS.slice(1).map((c) => [c.id]))('stands chair %s inside the office, clear of the desk and lamp spot', …);
it.each(DRESSERS.slice(1).map((d) => [d.id]))('stands dresser %s against the angled wall, inside the office', (id) => {
  // its back face is within 0.05 ± 0.01 of the wall line; every corner inside the office
});
it('swaps pieces without leaking', () => { /* chair A → B → A: one office-reading-chair group, old geometries disposed */ });
it('shows nothing for none', () => { /* all three 'none' → none of the three groups present or all hidden */ });
```

- [ ] **Step 2–4:** run red, implement (one builder function per piece), run `npm test && npm run lint && npm run typecheck && npm run build` green.
- [ ] **Step 5: Commit** — "Furnish the office's reading corner with the chosen chair, dresser and rug".

### Task 10: Reading-corner lists in the office panel

**Files:** Modify `src/components/OfficePanel.tsx` (new `ReadingCornerSection` component file if it reads better); Test `src/components/App.test.tsx`

**Interfaces — Produces:** a section `<h2>Reading corner</h2>` after Lighting with `<h3>` + `ProductList` for "Reading chair", "Dresser", "Round rug" (rug list with `thumb={(r) => r.shape ? roundRugThumbnail(r.shape.pattern) : ''}`), labelled by their h3s, meta `vendor · price` or "Leave it out", and a note: "The pieces are simplified shapes. Prices and stock were checked on {CORNER_CHECKED} and change often."

- [ ] **Step 1: Write the failing tests** — each list selects and saves (`lastApplied().office.readingChair` etc.); a shop link does not select.
- [ ] **Step 2–4:** red, implement, green (`npm test && npm run lint`).
- [ ] **Step 5: Commit** — "List reading-corner products in the office panel".

### Task 11: Render check, baselines, PR B (controller)

- [ ] **Step 1:** Render the office by day and evening with every product once; check nothing stands in walls, the desk, cabinets or the door's swing, and the rug sits in front of the window. Show the owner; adjust `CORNER` constants.
- [ ] **Step 2:** `npm run test:visual`: expected failures only in Office and Apartment views (and customised variants); add `Office, reading corner, day|eve` screenshots of the defaults if the Office view doesn't show the corner well.
- [ ] **Step 3:** Re-record only those, update README, full check list, commit — "Refresh the office screenshots for the reading corner".
- [ ] **Step 4:** Whole-branch review, fix wave, file the PR, merge on the owner's yes.
