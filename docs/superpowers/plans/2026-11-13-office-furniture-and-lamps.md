# Office Furniture and Lamp Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the office's real furniture, and let the living room and office each try real pendant and floor lamps that light the room in the evening.

**Architecture:** The office furniture is a new hand-drawn module (`src/scene/office/`) built on the bedroom's `kit` helpers, with its cabinet colour following the office wall paint. Lamps are catalog products with a drawable `shape`; a `roomLamps` module swaps the chosen lamp's geometry and owns its point light. Settings grow additively (version stays 2).

**Tech Stack:** React 19, TypeScript, three.js 0.187, Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-office-furniture-and-lamps-design.md`

## Global Constraints

- Two PRs: Tasks 1–3 (office furniture), then Tasks 4–9 (lamps), the second branched from `main` after the first merges.
- Settings `version` stays `2`; a saved design without the new fields must load unchanged.
- Every lamp setting defaults to `'none'`; with defaults, every existing screenshot baseline stays unchanged in PR 2.
- Lamp lights are warm `0xffc890`, shadowless, on only in the evening.
- No models are loaded for the office or for lamps; everything is drawn in code.
- Scene coordinates are metres; sizes in tables below are metres unless marked cm.
- Each PR passes `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm run test:visual` locally (set `PW_PORT` if 5199 is busy).
- Commit messages are plain sentences (as in `git log`) and end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Product prices and stock are recorded with the date checked; the panel note states that date.

## Review Focus

1. A saved design holding a lamp id that is no longer in the catalog: the room loads with no lamp, not a crash (Task 5 test).
2. Changing the office wall paint: the cabinets change with it, by day and in the evening (Task 1 test).
3. Switching lamps repeatedly: the old lamp's geometry and materials are disposed and only one pendant and one floor lamp per room are ever in the scene (Task 8 test).
4. Daylight with lamps chosen: lamp lights are at intensity 0 and shades do not glow (Task 8 test).
5. Clicking a product's "Open at …" link: it opens the shop and does not select the product (Task 6 test).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/scene/office/dimensions.ts` (new) | sizes and positions of the office pieces |
| `src/scene/office/index.ts` (new) | `buildOffice`: builds the pieces, recolours the cabinets |
| `src/scene/office/cabinets.ts`, `desk.ts`, `chair.ts` (new) | one builder each |
| `src/scene/office/office.test.ts` (new) | placement and recolouring tests |
| `src/components/OfficePanel.tsx` (new) | office panel: finishes, furniture note, later lighting |
| `src/data/catalog.ts` | `Lamp`, `LampShape`, `PENDANTS`, `FLOOR_LAMPS`, `LAMPS_CHECKED` |
| `src/state/settings.ts` | `LampSettings`, `office`, living lamp fields |
| `src/components/ProductList.tsx` (new) | generic product list; `RugList` uses it |
| `src/components/LightingSection.tsx` (new) | pendant + floor lamp lists for one room |
| `src/scene/lamps.ts` (new) | `buildLamp(shape)` |
| `src/scene/roomLamps.ts` (new) | per-room lamp swapping and lights |
| `src/scene/roomLights.ts` | fill light level depends on chosen lamps |

---

# PR 1: Office furniture

### Task 1: Office furniture scene module

**Files:**
- Create: `src/scene/office/dimensions.ts`, `cabinets.ts`, `desk.ts`, `chair.ts`, `index.ts`
- Test: `src/scene/office/office.test.ts`

**Interfaces:**
- Consumes: `kit(parent)` and `Kit` from `src/scene/bedroom/kit.ts`; `mergeMeshes` from `src/scene/merge.ts`; `lin`, `std` from `src/scene/materials.ts`; `PAINTS`, `findById` from `src/data/catalog.ts`; `roomById` from `src/data/rooms.ts`.
- Produces:
  ```ts
  export interface Office { apply(s: Settings): void; dispose(): void }
  export function buildOffice(parent: THREE.Object3D): Office
  ```
  The cabinet meshes use one material named `'office-cabinet'` (`material.name`), so tests and later tasks can find it.

**Sizes and positions (`dimensions.ts`)** — the office's left wall is z = −1.925, its back wall x = 11.89:

| Constant | Value |
|---|---|
| `WALL_GAP` | 0.02 |
| `CABINET` | `{ w: 0.6, d: 0.6, h: 2.0, plinth: 0.08, topH: 0.4, tops: 2 }` (stack top at 2.88) |
| `CABINET_X` | centres `[9.27, 9.87]` (the pair spans x 8.97–10.17, leaving 1 m to the desk front) |
| `CABINET_Z` | −1.925 + `WALL_GAP` + 0.3 = −1.605 |
| `DESK` | `{ w: 1.2, d: 0.7, h: 0.75, top: 0.02 }`, long side along z |
| `DESK_X`, `DESK_Z` | 11.89 − `WALL_GAP` − 0.35 = 11.52; −1.925 + `WALL_GAP` + 0.6 = −1.305 |
| `DRAWERS` | `{ w: 0.42, d: 0.47, h: 0.61 }`, centre x 11.57, z −0.955 (under the desk's free end) |
| `CHAIR` | seat centre x 10.95, z −1.5, facing +x; sizes from IKEA's page |

Before writing the code, open IKEA Sweden's pages for METOD high cabinet 60×60×200, METOD top cabinet 60×60×40, IDÅSEN desk 120×70, IDÅSEN drawer unit and the desk chair the owner named ("idefjäll"; find the matching IKEA chair) and correct any size in the table that differs. Record the corrections in the commit message.

**Look:** cabinets are flat-fronted boxes with a 3 mm dark gap line between the high cabinet's two doors and between each stacked unit, plinth in the same material. Desk: dark top (`#3B3A38`, roughness 0.6) on a dark steel T-leg frame (`#2B2B2B`, metalness 0.5). Drawer unit: dark steel box with three drawer fronts. Chair: five-star base, gas stem, seat, backrest, dark grey fabric (`#3A3D40`).

- [ ] **Step 1: Write the failing tests** in `office.test.ts`

```ts
const build = () => { const g = new THREE.Group(); const office = buildOffice(g); return { g, office }; };
const box = (g: THREE.Object3D) => new THREE.Box3().setFromObject(g);

it('stands inside the office outline, on the floor, under the ceiling', () => {
  const { g } = build();
  const b = box(g);
  expect(b.min.x).toBeGreaterThanOrEqual(8.89);
  expect(b.max.x).toBeLessThanOrEqual(11.89);
  expect(b.min.z).toBeGreaterThanOrEqual(-1.925);
  expect(b.min.y).toBeGreaterThanOrEqual(0);
  expect(b.max.y).toBeCloseTo(2.88, 2);
});
it('leaves the opening to the living room clear', () => {
  /* nothing within 0.9 m of the west wall between z −0.185 and 0.685 */
  const { g } = build();
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const b = new THREE.Box3().setFromObject(o);
    const inDoorway = b.min.x < 9.79 && b.max.z > -0.185 && b.min.z < 0.685;
    expect(inDoorway).toBe(false);
  });
});
it('paints the cabinets in the office wall colour', () => {
  const { g, office } = build();
  office.apply({ ...DEFAULTS, walls: { ...DEFAULTS.walls, office: 'linen' } });
  const mats = new Set<THREE.Material>();
  g.traverse((o) => { if (o instanceof THREE.Mesh && !Array.isArray(o.material)) mats.add(o.material); });
  const cabinet = [...mats].find((m) => m.name === 'office-cabinet') as THREE.MeshStandardMaterial;
  expect(cabinet.color.getHex()).toBe(lin(findById(PAINTS, 'linen').hex).getHex());
});
it('draws few meshes', () => {
  let n = 0;
  build().g.traverse((o) => { if (o instanceof THREE.Mesh) n++; });
  expect(n).toBeLessThanOrEqual(12);
});
```

- [ ] **Step 2: Run** `npx vitest run src/scene/office` — expected: FAIL, `buildOffice` not found.
- [ ] **Step 3: Implement** the five files. `index.ts` builds each piece through `k.collect(...)` and `mergeMeshes`, sets the cabinet colour in `apply` from `settings.walls.office`, and `dispose` does nothing beyond what `disposeTree(scene)` already frees (keep the method for symmetry with `Bedroom`).
- [ ] **Step 4: Run** `npx vitest run src/scene/office` — expected: PASS.
- [ ] **Step 5: Commit** — "Draw the office's cabinets, desk, drawer unit and chair".

### Task 2: Show the office furniture in the app

**Files:**
- Modify: `src/scene/createScene.ts` (build after `buildApartment`, call in `apply`, call `dispose`)
- Create: `src/components/OfficePanel.tsx`
- Modify: `src/components/Panel.tsx` (office → `OfficePanel`), `src/components/SimpleRoomPanel.tsx` (drop the office blurb)
- Test: `src/components/App.test.tsx`

**Interfaces:**
- Consumes: `buildOffice(parent): Office` from Task 1.
- Produces: `export function OfficePanel({ settings, update }: { settings: Settings; update: Update })`, with heading "Office", the size line `roomSize(roomById('office'))`, `FinishSection room="office"`, and a `<section>` headed "Furniture" containing a `<p className="note">` that names each piece with its size and says the cabinets follow the wall colour.

- [ ] **Step 1: Write the failing test** in `App.test.tsx`

```ts
it('shows the office with its furniture note', async () => {
  await renderIn('office');
  expect(screen.getByRole('heading', { name: 'Office' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Furniture' })).toBeVisible();
  expect(screen.getByText(/METOD/)).toBeVisible();
  expect(screen.getByText(/IDÅSEN/)).toBeVisible();
  expect(screen.getByRole('group', { name: 'Wall colour' })).toBeVisible();
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/App.test.tsx` — expected: FAIL (no "Furniture" heading).
- [ ] **Step 3: Implement** the panel and the scene wiring.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — expected: all pass.
- [ ] **Step 5: Commit** — "Show the office furniture and give the office its own panel".

### Task 3: Placement check, baselines, PR

**Files:**
- Modify: `e2e/visual.spec.ts-snapshots/*` (office and apartment views only), `README.md` (structure section: `scene/office/`)
- Possibly modify: `src/data/catalog.ts` `VIEWS` — add `{ name: 'Desk', icon: 'room', room: 'office', pose }` only if the existing Office view does not show the desk and cabinets clearly.

- [ ] **Step 1:** Start the dev server (`preview_start`), open the office, and screenshot the Office view by day and evening, plus one view from above.
- [ ] **Step 2:** Show the owner the renders and ask whether the placement and sizes are right. Apply corrections in `dimensions.ts` and re-run Task 1's tests. Do not continue until the owner confirms.
- [ ] **Step 3:** Run `npm run test:visual`. Expected failures: Office and Apartment views (day, eve, custom) only. Any other failing view is a bug to fix, not a baseline to refresh.
- [ ] **Step 4:** Re-record only those baselines (`npx playwright test e2e/visual.spec.ts -g "Office|Apartment" --update-snapshots`), run the full visual suite again — expected: all pass.
- [ ] **Step 5:** Update `README.md`, run the full check list from Global Constraints, commit — "Refresh the office and apartment screenshots for the office furniture".
- [ ] **Step 6:** File the PR with before/after renders, wait for CI and an independent review, and merge only on the owner's yes.

**As built (owner's corrections, 13 Nov 2026).** The table in Task 1 was superseded. `WALL_GAP` is 0.05 (more than the sun's shadow normalBias of 0.02; at 0.02 a face beside a wall rendered striped). Cabinets stand against the entrance wall (x = 8.89) in the corner with the left wall: x 8.94–9.54, z −1.875…−0.675, fronts facing +x. The desk is against the back wall: x 11.14–11.84, z −1.405…−0.205. The drawer unit is on the floor between the desk and the left wall: z −1.875…−1.455, fronts facing −x. The chair is the IKEA ALEFJÄLL, beige `#C9B8A0`, 64 × 64 cm, seat 51 × 42 at 50 cm, 95 cm high, in front of the desk's middle. `buildOffice(parent)` returns `{ apply(s), dispose() }`, with no materials argument and no `showFrom`. Task 3's "Office and Apartment views only" turned out to include the Living room views too: the cabinets show at the edge of that view, so its baselines changed as well.

---

# PR 2: Lamps

### Task 4: Lamp catalog

**Files:**
- Modify: `src/data/catalog.ts`
- Test: `src/data/catalog.test.ts`

**Interfaces — Produces:**
```ts
export type LampShape =
  | { type: 'globe'; d: number; colour: string }                 // sphere shade
  | { type: 'dome'; d: number; h: number; colour: string }       // metal shade open below
  | { type: 'drum'; d: number; h: number; colour: string }       // cylinder textile shade
  | { type: 'arc'; h: number; reach: number; shadeD: number; colour: string }
  | { type: 'tripod'; h: number; shadeD: number; shadeH: number; colour: string }
  | { type: 'uplight'; h: number; bowlD: number; colour: string };
export interface Lamp { id: string; kind: 'pendant' | 'floor'; name: string; vendor: string; price: string;
  stock: string; st: StockState; url: string; shape: LampShape | null }
export const PENDANTS: Lamp[];     // 'none' first, then about four products
export const FLOOR_LAMPS: Lamp[];  // 'none' first, then about four products
export const LAMPS_CHECKED: string; // e.g. '13 Nov 2026'
```
The `none` entries are `{ id: 'none', name: 'No pendant' | 'No floor lamp', vendor: '', price: '', stock: '', st: 'un', url: '', shape: null }`. `colour` is the shade's sRGB hex.

**Choosing the products:** search Swedish retailers (IKEA, Granit, Mio, Ellos, Lampgallerian, Nordic Nest or similar) for lamps currently listed. Requirements: at least one product per archetype across the two lists; pendants 35–80 cm across; a price spread from under 1 000 kr to over 3 000 kr; each has a working product URL, a listed price, and a stock state read from the page (`ok` in stock, `no` sold out, `un` not shown). Take each shape's sizes from the product's listed dimensions.

- [ ] **Step 1: Write the failing tests**

```ts
describe.each([['PENDANTS', PENDANTS, 'pendant'], ['FLOOR_LAMPS', FLOOR_LAMPS, 'floor']] as const)('%s', (_n, list, kind) => {
  it('starts with none and has unique ids', () => {
    expect(list[0].id).toBe('none');
    expect(new Set(list.map((l) => l.id)).size).toBe(list.length);
    expect(list.length).toBeGreaterThanOrEqual(4);
  });
  it('gives every product a kind, vendor, price, https link and shape', () => {
    for (const l of list.slice(1)) {
      expect(l.kind).toBe(kind);
      expect(l.vendor).not.toBe('');
      expect(l.price).not.toBe('');
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.shape).not.toBeNull();
    }
  });
});
it('covers every lamp archetype', () => {
  const types = new Set([...PENDANTS, ...FLOOR_LAMPS].flatMap((l) => (l.shape ? [l.shape.type] : [])));
  expect([...types].sort()).toEqual(['arc', 'dome', 'drum', 'globe', 'tripod', 'uplight']);
});
it('keeps pendant and floor shapes apart', () => {
  for (const l of PENDANTS.slice(1)) expect(['globe', 'dome', 'drum']).toContain(l.shape!.type);
  for (const l of FLOOR_LAMPS.slice(1)) expect(['arc', 'tripod', 'uplight']).toContain(l.shape!.type);
});
```

- [ ] **Step 2: Run** `npx vitest run src/data` — expected: FAIL, exports missing.
- [ ] **Step 3: Research the products and add the types and lists.**
- [ ] **Step 4: Run** `npx vitest run src/data` — expected: PASS.
- [ ] **Step 5: Commit** — "Add pendant and floor lamp products to the catalog".

### Task 5: Lamp settings

**Files:**
- Modify: `src/state/settings.ts`
- Test: `src/state/settings.test.ts`

**Interfaces:**
- Consumes: `PENDANTS`, `FLOOR_LAMPS` (Task 4).
- Produces:
  ```ts
  export interface LampSettings { pendant: string; floorLamp: string }
  export interface LivingSettings extends LampSettings { hidden: string[] }
  export interface Settings { /* existing */ office: LampSettings }
  export type SettingsPatch = /* existing */ & { office?: Partial<LampSettings> }
  ```
  `DEFAULTS.living` gains `pendant: 'none', floorLamp: 'none'`; `DEFAULTS.office = { pendant: 'none', floorLamp: 'none' }`. `applyPatch` merges `office` like `living`.

- [ ] **Step 1: Write the failing tests**

```ts
const P = PENDANTS[1].id, F = FLOOR_LAMPS[1].id;
it('defaults every lamp to none', () => {
  const s = sanitizeSettings(null);
  expect(s.living).toMatchObject({ pendant: 'none', floorLamp: 'none' });
  expect(s.office).toEqual({ pendant: 'none', floorLamp: 'none' });
});
it('loads a version 2 design saved before lamps existed unchanged', () => {
  const old = { version: 2, room: 'living', time: 'eve', walls: DEFAULTS.walls, bedroom: DEFAULTS.bedroom, living: { hidden: ['sofa'] } };
  expect(sanitizeSettings(old)).toEqual({ ...DEFAULTS, room: 'living', time: 'eve', living: { hidden: ['sofa'], pendant: 'none', floorLamp: 'none' } });
});
it('keeps valid lamp ids and drops unknown ones', () => {
  const s = sanitizeSettings({ version: 2, living: { pendant: P, floorLamp: 'gone' }, office: { pendant: 'gone', floorLamp: F } });
  expect(s.living).toMatchObject({ pendant: P, floorLamp: 'none' });
  expect(s.office).toEqual({ pendant: 'none', floorLamp: F });
});
it('does not accept a floor lamp id as a pendant', () => {
  expect(sanitizeSettings({ version: 2, office: { pendant: F } }).office.pendant).toBe('none');
});
it('patches one office lamp without touching the other', () => {
  const s = applyPatch({ ...DEFAULTS, office: { pendant: P, floorLamp: F } }, { office: { pendant: 'none' } });
  expect(s.office).toEqual({ pendant: 'none', floorLamp: F });
});
```

- [ ] **Step 2: Run** `npx vitest run src/state` — expected: FAIL.
- [ ] **Step 3: Implement.** Add a `sanitizeLamps(raw): LampSettings` helper used for both rooms.
- [ ] **Step 4: Run** `npm test && npm run typecheck` — expected: PASS (fix any test fixture that builds a `Settings` by hand).
- [ ] **Step 5: Commit** — "Save a pendant and floor lamp choice for the living room and office".

### Task 6: Product list and lighting sections

**Files:**
- Create: `src/components/ProductList.tsx`, `src/components/LightingSection.tsx`
- Modify: `src/components/RugList.tsx`, `LivingPanel.tsx`, `OfficePanel.tsx`
- Test: `src/components/App.test.tsx`

**Interfaces:**
- Consumes: Task 4 lists, Task 5 settings.
- Produces:
  ```ts
  export interface Product { id: string; name: string; vendor: string; price: string; stock: string; st: StockState; url: string }
  export function ProductList<T extends Product>(props: {
    label: string;                       // aria-label of the list's group
    items: readonly T[]; value: string; onChange: (id: string) => void;
    meta: (item: T) => string;           // the line under the name
    thumb?: (item: T) => string;         // image src; '' or absent draws the empty tile
  }): JSX.Element
  export function LightingSection(props: { room: 'living' | 'office'; settings: Settings; update: Update }): JSX.Element
  ```
  `ProductList` renders exactly `RugList`'s current markup and class names (`.rugs`, `.rug`, `.meta`, `.st`), wrapped in `role="group"` with `aria-label={label}`. `RugList` keeps its `<section><h2>Rug</h2>` and passes `meta` = today's text (`vendor · price · sizes`, or "Show the bare floor"). `LightingSection` renders `<section><h2>Lighting</h2>`, a "Pendant" list (`label="Pendant"`), a "Floor lamp" list (`label="Floor lamp"`), and a `<p className="note">` saying the lamps are simplified shapes and prices and stock were checked on `LAMPS_CHECKED`. Lamp `meta` is `vendor · price`, or "Leave it out" for `none`. It is placed after the finish section in both panels.

- [ ] **Step 1: Write the failing tests**

```ts
describe.each([['living', 'Living room'], ['office', 'Office']] as const)('lighting in the %s', (room) => {
  it('offers pendants and floor lamps and applies the choice', async () => {
    await renderIn(room);
    const pendants = screen.getByRole('group', { name: 'Pendant' });
    await userEvent.click(within(pendants).getByRole('button', { name: new RegExp(PENDANTS[1].name) }));
    expect(lastApplied()[room].pendant).toBe(PENDANTS[1].id);
    expect(stored()[room].pendant).toBe(PENDANTS[1].id);
    const floor = screen.getByRole('group', { name: 'Floor lamp' });
    await userEvent.click(within(floor).getByRole('button', { name: new RegExp(FLOOR_LAMPS[1].name) }));
    expect(lastApplied()[room].floorLamp).toBe(FLOOR_LAMPS[1].id);
    expect(lastApplied()[room].pendant).toBe(PENDANTS[1].id);
  });
  it('does not select a lamp when its shop link is clicked', async () => {
    await renderIn(room);
    const link = within(screen.getByRole('group', { name: 'Pendant' })).getAllByRole('link')[0];
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(lastApplied()[room].pendant).toBe('none');
  });
});
it('still lists the bedroom rugs', async () => {
  await renderIn('bedroom');
  expect(within(screen.getByRole('group', { name: 'Rug' })).getAllByRole('button')).toHaveLength(RUGS.length);
});
```

- [ ] **Step 2: Run** `npx vitest run src/components` — expected: FAIL.
- [ ] **Step 3: Implement.** Existing rug tests must keep passing without edits other than adding the group label.
- [ ] **Step 4: Run** `npm test && npm run lint` — expected: PASS.
- [ ] **Step 5: Commit** — "List lamps to choose from in the living room and office panels".

### Task 7: Drawing a lamp

**Files:**
- Create: `src/scene/lamps.ts`
- Test: `src/scene/lamps.test.ts`

**Interfaces — Produces:**
```ts
export interface BuiltLamp {
  group: THREE.Group;                    // pendant: origin at the ceiling point; floor lamp: origin on the floor
  /** where the light sits, in the group's coordinates */
  bulb: THREE.Vector3;
  /** shade glow on (evening) or off */
  setGlow(on: boolean): void;
  dispose(): void;                       // frees the lamp's geometries and materials
}
/** `drop` is the distance from the ceiling to the shade's underside (pendants only) */
export function buildLamp(shape: LampShape, drop?: number): BuiltLamp
```
Pendants hang on a thin dark cord from y = 0 down to the shade, the shade's underside at y = −`drop`. Floor lamps stand from y = 0 up to `shape.h`. Shade materials are `MeshStandardMaterial` in `shape.colour` with `emissive` warm `#FFD9A0`; `setGlow(true)` sets `emissiveIntensity` 0.9 for textile and paper shades (`globe`, `drum`, `tripod`) and 0.25 for metal ones (`dome`, `arc`, `uplight`), `setGlow(false)` sets 0. Meshes cast and receive shadows, except shades, which do not cast. The `arc` lamp's shade hangs `reach` out along the group's +x.

- [ ] **Step 1: Write the failing tests**

```ts
const all = [...PENDANTS, ...FLOOR_LAMPS].filter((l) => l.shape);
it.each(all.map((l) => [l.id, l] as const))('draws %s within its listed size', (_id, lamp) => {
  const built = buildLamp(lamp.shape!, 1.2);
  const b = new THREE.Box3().setFromObject(built.group);
  expect(b.isEmpty()).toBe(false);
  if (lamp.kind === 'pendant') {
    expect(b.max.y).toBeCloseTo(0, 2);
    expect(b.min.y).toBeCloseTo(-1.2, 2);
  } else {
    expect(b.min.y).toBeCloseTo(0, 2);
    expect(b.max.y).toBeCloseTo((lamp.shape as { h: number }).h, 1);
  }
  expect(b.containsPoint(built.bulb)).toBe(true);
});
it('glows only when asked', () => {
  const built = buildLamp(PENDANTS[1].shape!, 1.2);
  const glow = () => { let e = 0; built.group.traverse((o) => { if (o instanceof THREE.Mesh) e = Math.max(e, (o.material as THREE.MeshStandardMaterial).emissiveIntensity ?? 0); }); return e; };
  built.setGlow(false); expect(glow()).toBe(0);
  built.setGlow(true); expect(glow()).toBeGreaterThan(0);
});
it('frees its geometry on dispose', () => {
  const built = buildLamp(FLOOR_LAMPS[1].shape!);
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  built.group.traverse((o) => { if (o instanceof THREE.Mesh) spies.push(vi.spyOn(o.geometry, 'dispose')); });
  built.dispose();
  for (const s of spies) expect(s).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run** `npx vitest run src/scene/lamps.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** one private function per archetype behind `buildLamp`'s `switch (shape.type)`.
- [ ] **Step 4: Run** the test — expected: PASS.
- [ ] **Step 5: Commit** — "Draw pendant and floor lamps from their catalog shape".

### Task 8: Lamps in the rooms, and their light

**Files:**
- Create: `src/scene/roomLamps.ts`
- Modify: `src/scene/roomLights.ts`, `src/scene/createScene.ts`
- Test: `src/scene/roomLamps.test.ts`

**Interfaces:**
- Consumes: `buildLamp` (Task 7), `Settings` (Task 5), `PENDANTS`, `FLOOR_LAMPS`, `findById`, `centroid`, `roomById`, `CEILING`, `roomAt(x, z, rooms)` from `src/scene/pickRoom.ts`.
- Produces:
  ```ts
  export const FLOOR_LAMP_SPOT: Record<'living' | 'office', { x: number; z: number; rotY: number }>;
  export interface RoomLamps { apply(s: Settings): void; dispose(): void }
  export function addRoomLamps(parent: THREE.Object3D): RoomLamps
  // roomLights.ts
  export function addRoomLights(scene: THREE.Scene): { apply(s: Settings): void }   // replaces setEvening
  ```
- Pendant: at the room's `centroid`, group at y = `CEILING`, `drop` = `CEILING − 2.1` = 1.2. Group name `` `${room}-pendant` ``.
- Floor lamp: at `FLOOR_LAMP_SPOT[room]`, group name `` `${room}-floor-lamp` ``. Office spot: `{ x: 11.55, z: 0.1, rotY: Math.PI }` (beside the desk's free end: past it (the desk ends at z −0.205) with room for a lamp base up to 25 cm in radius, against the back wall). The test must also check the spot is outside the desk's footprint (x 11.14–11.84, z −1.405…−0.205). Living room spot: read the sofa's bounding box from `public/models/living/sofa.glb` in the running app (`scene.getObjectByName('sofa')`) and put the lamp 0.35 m beyond the sofa's end that is farther from the hall, 0.3 m in front of its back; `rotY` turns an arc lamp's reach towards the sofa's centre. Write the resulting numbers as constants.
- Lights: one `THREE.PointLight(0xffc890, 0, 7, 1.3)` per chosen lamp at its `bulb`, no shadows, name `` `${group name}-light` ``. Evening intensity 0.9 for a pendant, 0.6 for a floor lamp; 0 by day. `setGlow(evening)`.
- `apply` rebuilds a lamp only when its id changed (dispose the old lamp and remove its light first).
- `roomLights.apply`: hall fill is 0.6 in the evening as today. Living room and office fill is 0.6 in the evening when both of that room's lamps are `'none'`, 0.15 when at least one is chosen, 0 by day.
- `createScene.ts`: build `addRoomLamps(scene)` after the office, call `roomLamps.apply(s)` and `roomLights.apply(s)` in `apply`, `roomLamps.dispose()` in `dispose`.

- [ ] **Step 1: Write the failing tests**

```ts
const P = PENDANTS[1].id, P2 = PENDANTS[2].id, F = FLOOR_LAMPS[1].id;
const withLamps = (over: Partial<Settings>) => ({ ...DEFAULTS, ...over });
const names = (g: THREE.Object3D) => g.children.map((c) => c.name).sort();
const light = (g: THREE.Object3D, n: string) => g.getObjectByName(n) as THREE.PointLight;

it('adds nothing with the default settings', () => {
  const g = new THREE.Group();
  addRoomLamps(g).apply(DEFAULTS);
  expect(g.children).toHaveLength(0);
});
it('hangs the pendant at the room centre, 2.1 m above the floor', () => {
  const g = new THREE.Group();
  addRoomLamps(g).apply(withLamps({ office: { pendant: P, floorLamp: 'none' } }));
  const p = g.getObjectByName('office-pendant')!;
  const [cx, cz] = centroid(roomById('office').poly);
  expect([p.position.x, p.position.z]).toEqual([cx, cz]);
  expect(new THREE.Box3().setFromObject(p).min.y).toBeCloseTo(2.1, 2);
});
it('keeps one pendant and one floor lamp per room when switching', () => {
  const g = new THREE.Group();
  const lamps = addRoomLamps(g);
  lamps.apply(withLamps({ living: { hidden: [], pendant: P, floorLamp: F } }));
  lamps.apply(withLamps({ living: { hidden: [], pendant: P2, floorLamp: F } }));
  expect(names(g)).toEqual(['living-floor-lamp', 'living-floor-lamp-light', 'living-pendant', 'living-pendant-light']);
  lamps.apply(DEFAULTS);
  expect(g.children).toHaveLength(0);
});
it('disposes the lamp it replaces and leaves an unchanged lamp alone', () => {
  const g = new THREE.Group();
  const lamps = addRoomLamps(g);
  lamps.apply(withLamps({ office: { pendant: P, floorLamp: F } }));
  const oldPendant = g.getObjectByName('office-pendant')!;
  const floor = g.getObjectByName('office-floor-lamp')!;
  let freed = 0;
  oldPendant.traverse((o) => { if (o instanceof THREE.Mesh) vi.spyOn(o.geometry, 'dispose').mockImplementation(() => { freed++; }); });
  lamps.apply(withLamps({ office: { pendant: P2, floorLamp: F } }));
  expect(freed).toBeGreaterThan(0);
  expect(g.getObjectByName('office-floor-lamp')).toBe(floor);
});
it('lights the lamps only in the evening', () => {
  const g = new THREE.Group();
  const lamps = addRoomLamps(g);
  lamps.apply(withLamps({ time: 'day', office: { pendant: P, floorLamp: F } }));
  expect(light(g, 'office-pendant-light').intensity).toBe(0);
  lamps.apply(withLamps({ time: 'eve', office: { pendant: P, floorLamp: F } }));
  expect(light(g, 'office-pendant-light').intensity).toBe(0.9);
  expect(light(g, 'office-floor-lamp-light').intensity).toBe(0.6);
  expect(light(g, 'office-pendant-light').castShadow).toBe(false);
});
it('stands each floor lamp inside its room', () => {
  for (const room of ['living', 'office'] as const) {
    const { x, z } = FLOOR_LAMP_SPOT[room];
    expect(roomAt(x, z, ROOMS)).toBe(room);   // roomAt from src/scene/pickRoom.ts
  }
});
/* roomLights */
it('dims the fill light only in a room with a lamp chosen', () => {
  const scene = new THREE.Scene();
  const fill = addRoomLights(scene);
  const at = (id: RoomId) => scene.children.find((l) => l.name === `${id}-fill`) as THREE.PointLight;
  fill.apply(withLamps({ time: 'eve' }));
  expect([at('hall').intensity, at('living').intensity, at('office').intensity]).toEqual([0.6, 0.6, 0.6]);
  fill.apply(withLamps({ time: 'eve', office: { pendant: P, floorLamp: 'none' } }));
  expect([at('hall').intensity, at('living').intensity, at('office').intensity]).toEqual([0.6, 0.6, 0.15]);
  fill.apply(withLamps({ time: 'day', office: { pendant: P, floorLamp: 'none' } }));
  expect(at('office').intensity).toBe(0);
});
```
(Name each fill light `` `${room.id}-fill` `` in `roomLights.ts`.)

- [ ] **Step 2: Run** `npx vitest run src/scene/roomLamps.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — expected: PASS.
- [ ] **Step 5: Commit** — "Hang and stand the chosen lamps, and light the room with them in the evening".

### Task 9: Visual checks, README, PR

**Files:**
- Modify: `e2e/visual.spec.ts`, `README.md`
- Create: new baselines in `e2e/visual.spec.ts-snapshots/`

- [ ] **Step 1:** Run `npm run test:visual` before adding tests — expected: every existing baseline passes unchanged (defaults are `none`). A failure here is a bug.
- [ ] **Step 2:** Add lamp screenshots to `e2e/visual.spec.ts`:

```ts
for (const time of ['day', 'eve'] as const) {
  for (const [room, view] of [['living', 'Living room'], ['office', 'Office']] as const) {
    test(`${view}, with lamps, ${time}`, async ({ page }) => {
      await openWith(page, { room, time, [room]: { pendant: PENDANTS[1].id, floorLamp: FLOOR_LAMPS[1].id } });
      await settled(page);
      await expect(page.locator('canvas.stage-canvas')).toHaveScreenshot(`${view}-lamps-${time}.png`.replace(/ /g, '-').toLowerCase(), overlays(page));
    });
  }
}
```

- [ ] **Step 3:** Record the four new baselines, then look at each one: the pendant hangs clear of the furniture, the floor lamp stands on the floor beside the sofa/desk and not inside anything, and the evening shots are visibly lit by the lamps. Try every product once in the running app in both rooms and fix any that intersects furniture or a wall.
- [ ] **Step 4:** Update `README.md` (lamps in the catalog, `scene/lamps.ts`, `scene/roomLamps.ts`), run the full check list from Global Constraints, commit — "Add screenshots of the living room and office with lamps".
- [ ] **Step 5:** File the PR with day and evening renders, wait for CI and an independent review, and merge only on the owner's yes. After the merge, confirm the Pages deploy and that the live site shows the lamp lists.

### As built (lamps)

- `Lamp.shape` is `LampShape | null` (null for 'none').
- Floor-lamp spots live in `src/scene/roomLamps.ts` (`FLOOR_LAMP_SPOT`): living `{ x: 4.25, z: -1.2, rotY: 0 }` at the
  sofa's west end between sofa and shelving (the east end is taken by the plant); office
  `{ x: 11.55, z: 0.1, rotY: Math.PI }`.
  Moved on 14 Nov 2026 to `{ x: 7.6, z: -1.2, rotY: Math.PI }`, beside the plant (see the 2026-11-14 design).
- The arc is a straight stem with a horizontal arm, not a curve.
- The catalog has four pendants and three floor lamps plus 'none', one of them discontinued and shown as such.
- Lamp lights are on (and visible) only in the evening.
