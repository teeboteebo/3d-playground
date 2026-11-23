# Moulding Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each room with wall moulding gets a live "Shopping list" page that says which stock lengths to buy at the
cheapest proven price and how to cut every frame and rail piece from them. The products' real dimensions drive the 3D.

**Architecture:**
- Shared products and cut settings live in a new top-level `mouldShop` settings field.
- A profile helper turns them into the frame width, the rail height and the depths. The layout (rail height) and both
  moulding builders read it.
- One function lists a layout's frames, and one lists its rail segments. Both the strip drawing and a new pieces module
  use them, so the cut list can't drift from the render.
- A pure exact branch-and-bound optimiser packs pieces into stock lengths. It runs in a web worker behind a React hook,
  and the menu shows the result as a Shopping list page under Wall moulding.

**Tech Stack:** TypeScript, three.js, React 19, Vite (module workers), Vitest, Testing Library, Playwright (visual snapshots). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-24-moulding-shopping-list-design.md`

## Global Constraints

- Pieces come only from the shared layout (`wallLayouts`) through the shared `frames()` / `railSegments()` helpers. No second copy of the geometry.
- Products are shared by every room. Offcuts are reused only within a room. The list counts only walls whose moulding is switched on.
- Default panel moulding: 28 mm wide × 12 mm deep, no lengths. Rail switch (`railSeparate`) off by default. The rail is then the panel profile: height = panel width, depth = panel depth.
- Default separate rail product, used only when switched on: 40 mm high × 14 mm deep, no lengths.
- The same width and depths apply on every wall of both rooms. Per-wall depths go away.
- The bed wall's rail ends at `WARD_FRONT`.
- Defaults: kerf 3 mm, spare on, joins off, minimum piece 20 cm. A join is at least 10 cm from a frame corner, so a frame part is at least max(minimum piece, 10 cm) long.
- Frame pieces: 4 per frame, mitred both ends, long point = outer size (top/bottom = outer width, sides = outer height). Rail pieces: square both ends.
- Joined frame side (joins on): at most 2 parts, butt-joined square. Rail segment: fewest parts it needs (`ceil` over the longest stock), plus one more when joins are on.
- Kerf: a bar fits when Σ piece lengths + kerf × (pieces − 1) ≤ stock length.
- Objective, compared in order: total price, then total length bought, then number of bars. Split points are whole cm.
- Spare: one of the product's longest stock lengths, listed and priced separately from the optimised list.
- If the optimum isn't proven within 3 s, show the best list so far marked "not yet proven cheapest" and keep searching (cap 60 s).
- Units: settings in cm/mm/kr as named. Optimiser works in integer mm and integer öre.
- Currency shown as `2 345 kr` (normal space as thousands separator, rounded to whole kr).
- Settings stay `version: 2`. New fields are filled by sanitising.

## Review Focus

1. A product with no lengths, or a frame side longer than every stock with joins off. Expect the empty state or a named "doesn't fit" list, never a crash or an endless "working". (Tasks 7, 9)
2. Settings typed mid-edit: empty, zero, negative or non-numeric length, price or width. Expect sanitising to drop or clamp them, and the list never to receive NaN. (Task 1)
3. Rapid slider drags while a solve is running. Expect only the latest settings' result to show, with no stale plan flashing in after a newer one. (Task 8)
4. A room with every moulding wall switched off. Expect "Nothing to buy", not a 0 kr list with bars. (Task 7)
5. A wide product (e.g. 60 mm, 40 mm rail) that makes the clamps draw fewer columns. Expect the list to match the fewer columns drawn, not the saved count. (Task 4)

---

### Task 1: Shop settings

**Files:**
- Create: `src/state/mouldShop.ts`, `src/state/mouldShop.test.ts`
- Modify: `src/state/settings.ts` (add `mouldShop: MouldShop` to `Settings` and `DEFAULTS`, sanitise it in `sanitizeSettings`), `src/state/settings.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface StockLength { length: number /* cm */; price: number /* kr */ }
  export interface MouldProduct { name: string; width: number /* mm; the rail's height for a rail */; depth: number /* mm */; lengths: StockLength[] }
  export interface MouldShop { panel: MouldProduct; railSeparate: boolean; rail: MouldProduct; kerf: number /* mm */; spare: boolean; joins: boolean; minPiece: number /* cm */ }
  export const SHOP_LIMITS: { width: {min:10,max:120}; depth: {min:5,max:60}; length: {min:10,max:600}; price: {min:0,max:100000}; kerf: {min:0,max:10}; minPiece: {min:10,max:100}; lengths: 10 /* max entries */ }
  export const SHOP_DEFAULTS: MouldShop  // panel {name:'', width:28, depth:12, lengths:[]}, rail {name:'', width:40, depth:14, lengths:[]}, railSeparate:false, kerf:3, spare:true, joins:false, minPiece:20
  export function sanitizeShop(raw: unknown): MouldShop
  ```

- [ ] **Step 1: Write failing tests** in `mouldShop.test.ts`:
  - `sanitizeShop(undefined)` equals `SHOP_DEFAULTS`.
  - widths/depths/kerf/minPiece outside `SHOP_LIMITS` are clamped. Non-numeric values fall back to the default.
  - `lengths` drops entries whose length is missing, non-finite or ≤ 0. Price `''`/`null`/negative becomes `0`. Duplicate lengths keep the first. At most 10 are kept, sorted by length ascending.
  - booleans accept only `true`/`false`, else default.
  - in `settings.test.ts`: `sanitizeSettings({ version: 2 })` has `mouldShop` deep-equal to `SHOP_DEFAULTS`, and a saved `mouldShop` round-trips through `saveSettings`/`loadSettings`.
- [ ] **Step 2: Run** `npx vitest run src/state` and expect FAIL (module missing).
- [ ] **Step 3: Implement** `sanitizeShop`, and wire `mouldShop` into `Settings`, `DEFAULTS` and `sanitizeSettings`. `SettingsPatch` already allows top-level fields. The UI always patches the whole `mouldShop` object.
- [ ] **Step 4: Run** `npx vitest run src/state` and expect PASS. Then run `npm run typecheck`.
- [ ] **Step 5: Commit** `Add the shared moulding products and cut settings`

### Task 2: Rail height through the layout

**Files:**
- Create: `src/scene/mouldProfile.ts`, `src/scene/mouldProfile.test.ts`
- Modify: `src/scene/mouldLayout.ts`, `src/scene/mouldLayout.test.ts`

**Interfaces:**
- Consumes: `MouldShop` (Task 1).
- Produces:
  ```ts
  // mouldLayout.ts
  export interface MouldRoom { spacing: number; dado: number; /** rail height, cm; default RAIL_H */ rail?: number }
  export function rows(spacing: number, dado: number, railH?: number /* m, default RAIL_H */): Rows
  export function spacingMax(dado: number, railH?: number): number
  export function dadoRange(spacing: number, railH?: number): { min: number; max: number }
  // mouldProfile.ts
  export interface MouldProfile { frameWidth: number; frameDepth: number; railHeight: number; railDepth: number } // metres
  export function mouldProfile(shop: MouldShop): MouldProfile
  export function mouldRoom(s: { mouldSpacing: number; mouldDado: number }, shop: MouldShop): MouldRoom // rail = railHeight in cm
  ```
  `RAIL_H` stays 0.04 as the fallback for callers without a shop (the legacy spacing cap in `settings.ts`).

- [ ] **Step 1: Write failing tests.**
  - `mouldProfile(SHOP_DEFAULTS)` gives `{frameWidth:0.028, frameDepth:0.012, railHeight:0.028, railDepth:0.012}`.
  - With `railSeparate:true` and the default rail, it gives `railHeight 0.04, railDepth 0.014`.
  - `rows(0.08, 0.77, 0.028).rail` is `[0.742, 0.77]`, and its lower row ends at `0.662`.
  - `spacingMax(0.77, 0.028)` is close to `0.231`, and `dadoRange(0.08, 0.028).min` is close to `0.468`.
  - Add a variant of the existing `layoutSection rules` sweep with `room.rail = 2.8`. Every gap is still S.
- [ ] **Step 2: Run** `npx vitest run src/scene/mouldLayout.test.ts src/scene/mouldProfile.test.ts` and expect FAIL.
- [ ] **Step 3: Implement.** Thread `room.rail` (cm → m) through `layoutSection` and `layoutWall` into `rows` and `spacingMax`.
- [ ] **Step 4: Run** the same tests and expect PASS. The existing tests stay green, since the default is unchanged.
- [ ] **Step 5: Commit** `Let the rail height come from the moulding product`

### Task 3: Products drive the render; rail stops at the wardrobe

**Files:**
- Modify: `src/scene/bedroom/moulding.ts`, `src/scene/bedroom/index.ts`, `src/scene/bedroom/bedside.ts` (+ `bedside.test.ts`), `src/scene/livingMoulding.ts` (+ test), `src/scene/mouldWalls.ts`, `src/scene/bedroom/moulding.test.ts`, `src/components/mouldingTopic.tsx`, `src/components/MouldingSection.tsx`, `src/scene/bedroom/dimensions.ts` (delete `FRAME_T`), `e2e/visual.spec.ts-snapshots/*`

**Interfaces:**
- Consumes: `mouldProfile`, `mouldRoom` (Task 2), `Settings.mouldShop` (Task 1).
- Produces:
  - `MouldWallParts.layout(s: BedroomSettings, shop: MouldShop): void`
  - `bedside.standOff(depth: number /* m */): void`, which moves the nightstands so their backs sit `depth` off the bed wall (replaces `BED_WALL_STRIP_DEPTH`, which is deleted)
  - `MouldingRoomControls` gains a `railHeight: number /* m */` prop, used in `spacingMax` and `dadoRange`.

- [ ] **Step 1: Write failing tests.**
  - bedroom `moulding.test.ts`: with `SHOP_DEFAULTS`, every frame strip on both walls is 0.028 thick and 0.012 deep, and the rail strip is 0.028 tall and 0.012 deep.
  - With a 50 mm / 20 mm panel product, the strips are 0.05 / 0.02.
  - The bed wall's rail max x is `WARD_FRONT`.
  - living: the same depth and width checks.
  - bedside: after `standOff(0.02)`, the nightstand backs are at `−L/2 + 0.02`.
- [ ] **Step 2: Run** `npx vitest run src/scene` and expect FAIL.
- [ ] **Step 3: Implement.**
  - Build `MouldRoom` with `mouldRoom(s, settings.mouldShop)` everywhere a room is built (bedroom, living, `mouldingTopic`).
  - Pass the profile's width and depths to `drawSection` and `drawRail`.
  - In bedroom `apply`, call `bedside.standOff(profile.frameDepth)`.
  - Set the bed wall's `rail` to `[[WINDOW_SIDE, WARD_FRONT]]`.
- [ ] **Step 4: Run** `npx vitest run`, `npm run typecheck` and `npm run lint`. Expect PASS.
- [ ] **Step 5: Update snapshots.** Run `npm run test:visual -- --update-snapshots`. Look at the bed-wall and dresser-wall images: the rail is thinner, and there's no rail behind the wardrobe.
- [ ] **Step 6: Commit** `Draw the moulding at the product's size, and end the bed-wall rail at the wardrobe`

### Task 4: Pieces from the drawn layout

**Files:**
- Create: `src/scene/mouldPieces.ts`, `src/scene/mouldPieces.test.ts`
- Modify: `src/scene/mouldStrips.ts`, `src/scene/mouldWalls.ts` (`above` entries gain `name: string`, `'door'` on the dresser wall), `src/scene/mouldLayout.ts` (`SectionLayout.over` items carry `name`)

**Interfaces:**
- Consumes: `wallLayouts`, `MouldWallDef`, `SectionLayout`.
- Produces:
  ```ts
  // mouldStrips.ts — drawSection/drawRail now draw from these
  export interface Frame { x: [number, number]; y: [number, number]; row: 'lower' | 'upper' | 'over'; column: number /* 1-based across the wall's sections; 0 for 'over' */; name?: string }
  export function frames(layouts: SectionLayout[]): Frame[]
  export function railSegments(segments: readonly (readonly [number, number])[]): [number, number][] // drops empty ones
  // mouldPieces.ts
  export type End = 'mitre' | 'square';
  export interface Piece { id: string; label: string; length: number /* mm, rounded */; kind: 'frame' | 'rail'; ends: [End, End] }
  export function wallPieces<K extends string>(def: MouldWallDef<K>, layouts: SectionLayout[]): Piece[]
  ```
  Labels: `"Bed wall · lower · column 2 · top"` (sides `top|bottom|left|right`), `"Dresser wall · over door · left"`, `"Sofa wall · rail · 2 of 3"` (rail segments numbered left to right; a single segment is `"Sofa wall · rail"`). Ids are stable and unique, e.g. `bed-lower-2-top`, `dresser-rail-1`.

- [ ] **Step 1: Write failing tests.**
  - For each wall in `BEDROOM_MOULD_WALLS` and `LIVING_MOULD_WALLS`, over a sweep of settings (spacing 4/8/20, columns 1/3/6, rail 2.8/4 cm): every `Frame` from `frames()` has the same outer box as the four strips `drawSection` draws for it, using a recording `StripFn`.
  - `wallPieces` gives 4 pieces per frame. Top and bottom equal `round((x1−x0)·1000)` and sides `round((y1−y0)·1000)`, all with `['mitre','mitre']`.
  - Rail pieces equal the segment lengths with `['square','square']`.
  - The dresser wall includes the four "over door" pieces.
  - A wide product that clamps the column count yields pieces only for the drawn columns (Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run src/scene/mouldPieces.test.ts` and expect FAIL.
- [ ] **Step 3: Implement** `frames` and `railSegments`. Rewrite `drawSection` and `drawRail` to iterate them, so the render doesn't change. Then implement `wallPieces`.
- [ ] **Step 4: Run** `npx vitest run` and expect PASS. Visual snapshots should be unchanged: run `npm run test:visual`.
- [ ] **Step 5: Commit** `List the moulding's cut pieces from the same frames the scene draws`

### Task 5: Exact optimiser (whole pieces)

**Files:**
- Create: `src/lib/cutting/optimise.ts`, `src/lib/cutting/optimise.test.ts`, `src/lib/cutting/bruteForce.ts` (test helper)

**Interfaces:**
- Produces:
  ```ts
  export interface CutItem { id: string; length: number /* mm */; maxParts: number /* 1 = never split */; minPart: number /* mm */ }
  export interface Stock { length: number /* mm */; price: number /* öre */ }
  export interface Cut { item: string; length: number /* mm */; part?: { index: number; of: number } }
  export interface Bar { stock: number /* index into stocks */; cuts: Cut[]; offcut: number /* mm */ }
  export interface CutPlan { bars: Bar[]; cost: number /* öre */; total: number /* mm bought */; proven: boolean; unfit: string[] /* item ids */ }
  export interface OptimiseOptions { kerf: number /* mm */; deadline?: number /* ms timestamp */; onImprove?: (plan: CutPlan) => void; now?: () => number }
  export function optimise(items: CutItem[], stocks: Stock[], opts: OptimiseOptions): CutPlan
  export function better(a: CutPlan, b: CutPlan): boolean // a < b by (cost, total, bars.length)
  ```

**Algorithm** (the signature doesn't decide it):
- Items that can't be placed (length > longest stock and `maxParts` 1) go to `unfit` and are skipped.
- Seed the incumbent with first-fit decreasing: for each item, longest first, use the open bar with the least room left that fits it. Otherwise open the cheapest stock per mm that fits it. Then shrink each bar to the cheapest stock that still holds its cuts.
- Depth-first branch and bound over items sorted by length, longest first. At each item, try:
  - each open bar that fits it, skipping bars whose (stock, room left) duplicates one already tried at this level
  - opening one new bar of each stock that fits it
  - for identical consecutive items, only bars at an index ≥ the previous identical item's bar (symmetry)
- Lower bound: cost so far + ⌈(remaining item mm + kerf per remaining item − room left in open bars) × min price per mm⌉, clamped at ≥ cost so far. Prune when the bound can't beat the incumbent under `better`.
- When the search space is exhausted, `proven = true`. Past `deadline`, stop and return the incumbent with `proven = false`. Call `onImprove` on every new incumbent.
- Finally, shrink each bar to its cheapest fitting stock. Offcut = stock − Σ cuts − kerf × (cuts − 1).

- [ ] **Step 1: Write failing tests.**
  - `bruteForce(items, stocks, kerf)` tries every assignment for ≤ 7 items and 3 stocks. For 200 seeded random cases (seed in the test), `optimise(...).cost` and `.total` equal brute force, and `proven` is true.
  - Hand case: items `[1000,1000,1000]`, stocks `[{2400, 8900}, {3000, 10900}]`, kerf 3. Three pieces need 3006 mm > 3000, so the answer is two 2400 bars costing 17800.
  - Kerf boundary: `[1500,1497]` in a 3000 bar fits with kerf 3; `[1500,1498]` doesn't.
  - An item longer than every stock goes to `unfit`.
  - `deadline` already passed returns the FFD incumbent with `proven:false`.
  - `onImprove` costs strictly decrease.
- [ ] **Step 2: Run** `npx vitest run src/lib/cutting` and expect FAIL.
- [ ] **Step 3: Implement** `optimise` and `better`.
- [ ] **Step 4: Run** the tests and expect PASS. Also check a bedroom-sized case (60 items, 6 distinct lengths, 3 stocks) proves within 3 s. Add it as a test with a 3 s deadline that asserts `proven`.
- [ ] **Step 5: Commit** `Add an exact optimiser that packs moulding pieces into stock lengths`

### Task 6: Optimiser splitting (joins and long rails)

**Files:**
- Modify: `src/lib/cutting/optimise.ts`, `optimise.test.ts`, `bruteForce.ts`

**Interfaces:**
- Consumes/produces: same as Task 5. An item with `maxParts > 1` may be cut as up to `maxParts` parts, each ≥ `minPart`, summing to `length`. Parts are emitted as `Cut`s with `part: {index, of}`, numbered in the order they are placed.

**Algorithm addition:** in the branch for an item with `maxParts > 1`, also try splitting into the room left of each open bar. The part length is min(room rounded down to 10 mm, length − minPart), and the rest must be ≥ `minPart` and placeable in the remaining parts (rest ≤ (parts left) × longest stock). The rest continues as an item with `maxParts − 1`.
- Dominance: filling the tail as far as possible leaves the shortest rest, which never packs worse, so only that split point needs trying. Splitting into a new bar uses the longest stock fully: part = min(stock rounded down to 10 mm, length − minPart).
- An item longer than every stock is placeable when its length ≤ `maxParts` × longest stock.

- [ ] **Step 1: Write failing tests.**
  - The brute force enumerates every split at 10 mm steps for ≤ 5 items with `maxParts` 2. For 150 seeded random cases, the cost and total equal `optimise`.
  - A 5200 mm rail with stocks 2400/3000 and `maxParts` 2 becomes two parts, each ≥ `minPart`.
  - With `maxParts` 1, it's `unfit`.
  - Offcuts are reused: items `[2500, 2500, 1000]`, all `maxParts` 2 and minPart 200, stocks `[{3000, 10000}]`, kerf 0. This gives 2 bars, with the 1000 split 500 + 500. With every `maxParts` 1, it's 3 bars.
  - No part is < `minPart`.
- [ ] **Step 2: Run** `npx vitest run src/lib/cutting` and expect FAIL.
- [ ] **Step 3: Implement** the split branch.
- [ ] **Step 4: Run** the tests and expect PASS.
- [ ] **Step 5: Commit** `Let the optimiser join pieces to use offcuts and to make long rails`

### Task 7: A room's shopping list

**Files:**
- Create: `src/scene/shoppingList.ts`, `src/scene/shoppingList.test.ts`, `src/lib/format.ts` (+ test)

**Interfaces:**
- Consumes: `wallPieces`, `wallLayouts`, `mouldRoom`, `BEDROOM_MOULD_WALLS`/`LIVING_MOULD_WALLS`, `CutItem`/`Stock`/`CutPlan`, `Settings`.
- Produces:
  ```ts
  export type MouldRoomId = 'bedroom' | 'living';
  export interface ProductJob { product: 'panel' | 'rail'; name: string; stocks: Stock[]; items: CutItem[]; pieces: Piece[] }
  export interface ShoppingRequest { room: MouldRoomId; jobs: ProductJob[]; kerf: number } // empty jobs = nothing to buy
  export function shoppingRequest(room: MouldRoomId, settings: Settings): ShoppingRequest
  export interface BuyLine { length: number /* cm */; count: number; unitPrice: number /* kr */; price: number /* kr */ }
  export interface ProductResult { product: 'panel' | 'rail'; name: string; buy: BuyLine[]; spare: BuyLine | null; plan: CutPlan; unfit: Piece[] }
  export interface ShoppingResult { products: ProductResult[]; total: number /* kr, incl. spares */; proven: boolean }
  export function shoppingResult(req: ShoppingRequest, plans: CutPlan[] /* one per job */, shop: MouldShop): ShoppingResult
  // format.ts
  export function formatKr(kr: number): string // 2345 → '2 345 kr', 0 → '0 kr'
  ```
- Mapping:
  - Frame pieces become items with `maxParts` = joins ? 2 : 1 and `minPart` = max(minPiece, 10) cm.
  - Rail pieces get `maxParts` = ⌈length / longest stock⌉ (+1 if joins), minimum 1, and `minPart` = minPiece.
  - The rail goes in the panel job unless `railSeparate`.
  - A job whose product has no lengths makes the request report it as missing products: the job is present with `stocks: []`, and the UI shows the empty state.
  - Only walls whose toggle is `'on'` contribute.

- [ ] **Step 1: Write failing tests.**
  - The default bedroom request has one job (`panel`). Its item count = 4 × frames + rail segments, where the bed wall's rail is one segment ending at `WARD_FRONT`.
  - With `railSeparate`, there are two jobs.
  - With both walls off, `jobs` is empty (Review Focus 4).
  - With joins on, frame items have `maxParts` 2.
  - `shoppingResult` groups bars into `BuyLine`s by stock length, sorted longest first. The spare is one longest length at its price, and `total` includes it. With `spare:false`, the spare is null.
  - `proven` is the AND of the plans.
  - `formatKr(2345) === '2 345 kr'`, and `formatKr(1234567.4) === '1 234 567 kr'`.
- [ ] **Step 2: Run** `npx vitest run src/scene/shoppingList.test.ts src/lib/format.test.ts` and expect FAIL.
- [ ] **Step 3: Implement.** Convert prices kr → öre when building `Stock`s, and back when building `BuyLine`s.
- [ ] **Step 4: Run** the tests and expect PASS.
- [ ] **Step 5: Commit** `Turn a room's moulding into a shopping request and priced result`

### Task 8: Worker and live hook

**Files:**
- Create: `src/lib/cutting/worker.ts`, `src/components/useShoppingList.ts`, `src/components/useShoppingList.test.tsx`

**Interfaces:**
- Consumes: `optimise`, `shoppingRequest`, `shoppingResult`.
- Produces:
  ```ts
  // worker message in: { id: number; jobs: { items: CutItem[]; stocks: Stock[] }[]; kerf: number }
  // worker message out: { id: number; plans: CutPlan[]; done: boolean } — posted on each improvement (throttled to ≤ 1 per 200 ms) and once at the end; deadline = start + 60 s
  export type ShoppingState =
    | { status: 'empty' }                                   // no walls on
    | { status: 'needs-products'; products: ('panel'|'rail')[] }
    | { status: 'working'; result: ShoppingResult | null; slow: boolean } // slow after 3 s without done
    | { status: 'done'; result: ShoppingResult };
  export function useShoppingList(room: MouldRoomId, settings: Settings): ShoppingState
  ```
- Behaviour:
  - Recompute when `JSON.stringify(request)` changes, debounced 150 ms.
  - On a new request, terminate the running worker and start a new one, and ignore messages whose `id` isn't the latest (Review Focus 3).
  - When `typeof Worker === 'undefined'` (jsdom), run `optimise` synchronously with a 3 s deadline.
  - Create the worker with `new Worker(new URL('../lib/cutting/worker.ts', import.meta.url), { type: 'module' })`.

- [ ] **Step 1: Write failing tests** (jsdom, sync path, fake timers):
  - Default settings with no lengths give `needs-products: ['panel']`.
  - All walls off gives `empty`.
  - With lengths, the hook reaches `done`, and its `result.total` equals `shoppingResult` computed directly.
  - Changing the settings twice within 150 ms runs one solve, for the second settings.
- [ ] **Step 2: Run** `npx vitest run src/components/useShoppingList.test.tsx` and expect FAIL.
- [ ] **Step 3: Implement** the worker and the hook.
- [ ] **Step 4: Run** the tests and expect PASS. Run `npm run build`, and check that the worker is emitted as its own chunk.
- [ ] **Step 5: Commit** `Work out the shopping list live, off the main thread`

### Task 9: Shopping list and products pages

**Files:**
- Create: `src/components/ShoppingListPage.tsx`, `src/components/MouldShopControls.tsx`
- Modify: `src/components/mouldingTopic.tsx`, `src/components/BedroomPanel.tsx`, `src/components/LivingPanel.tsx`, `src/styles.css`, `src/components/App.test.tsx`, `e2e/visual.spec.ts` (+ snapshots)

**Interfaces:**
- Consumes: `useShoppingList`, `ShoppingState`, `MouldShop`, `formatKr`, `Update`.
- Produces:
  - `mouldingTopic(room, walls, settings, update, shopping: ShoppingState): Topic`. The panels call `useShoppingList` and pass it in.
  - The Wall moulding page's `topicsTitle` becomes `'Walls and shopping list'`. A last row `{ id: 'shopping', title: 'Shopping list' }` is added, whose summary is:
    - `formatKr(total)` when done
    - `'Add products'` when products are needed
    - `'Working it out…'` while working with no result yet
    - `'Nothing to buy'` when empty
  - The shopping page has one sub-topic `{ id: 'products', title: 'Products and settings' }`, with `MouldShopControls` as its content.

**Page content** (`ShoppingListPage`), in this order:
1. **Buy:** per product, its name (or "Panel moulding" / "Dado rail"), then one row per `BuyLine` (`6 × 240 cm  at 89 kr  534 kr`), then the spare row, then the room total.
2. **Cut plan:** one bar per `Bar`, drawn as a flex row of segments whose widths are proportional to mm. Each segment is labelled with its length in mm and the piece label (shown as a `title` and as text when there's room). The offcut is hatched.
3. **Cut list:** pieces grouped by wall and then frame, each with its length in mm and its ends (`⟋⟍` for a mitre, `|` for square). Joined sides show the parts, e.g. `top 1 210 = 820 + 390`, with the join measured from the left end.

Status banners:
- "Not yet proven cheapest, still checking" when `slow`, or when done with `proven:false`
- "These pieces don't fit any length: …, turn on joins or add a longer length" for `unfit`
- the products empty state, which links to the products page

**MouldShopControls:**
- Panel product: name, width (mm), depth (mm), and a lengths table with length (cm) and price (kr) per row, plus "Add length" and a remove button per row.
- The "Rail is a different product" switch, with the same fields for the rail when it's on.
- Kerf (mm), "Spare length", "Allow joins in panel frames", and minimum piece (cm).
- Inputs are `type="number"`. Every change is sent through `sanitizeShop` before `update({ mouldShop })`, so typing mid-edit can't save junk (Review Focus 2).

- [ ] **Step 1: Write failing tests** in `App.test.tsx`:
  - Open the bedroom, Wall moulding, then Shopping list. It shows "Add products".
  - Open Products and settings and add a length of 240 cm at 89 kr. Back on the Shopping list, "Buy" shows a row with `240 cm` and a total in `kr`.
  - The Wall moulding row summary shows the same total.
  - Switching both bedroom walls off shows "Nothing to buy".
  - Typing `-5` as a width leaves the stored width at the minimum (10).
- [ ] **Step 2: Run** `npx vitest run src/components/App.test.tsx` and expect FAIL.
- [ ] **Step 3: Implement** the pages, the wiring and the styles. It must read well at 375 px wide: rows wrap, and bars scroll horizontally inside their own box, never the page.
- [ ] **Step 4: Run** `npx vitest run`, `npm run typecheck` and `npm run lint`. Expect PASS.
- [ ] **Step 5: Add a visual snapshot.** In `e2e/visual.spec.ts`, open the bedroom shopping list at a 375 × 812 viewport with a seeded `mouldShop` (two lengths). Run `npm run test:visual -- --update-snapshots`, then look at the image.
- [ ] **Step 6: Commit** `Add the shopping list and products pages to the wall moulding menu`

### Task 10: Final check

- [ ] Run `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run test:e2e`, `npm run test:visual` and `npm run build`. All should pass.
- [ ] In the app (dev server), check the bedroom and the living room:
  - Add two lengths, and toggle the joins, the spare and the separate rail.
  - Drag the spacing slider and confirm the list follows.
  - Measure one panel's cut sizes against the 3D frame.
- [ ] Commit any fixes.
