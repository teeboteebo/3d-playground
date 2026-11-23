# Wall Moulding Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every moulding wall is laid out by one shared function that keeps one spacing S on all sides, with an adjustable dado height, a column count and one fixed column per wall. The bedroom nightstands are placed by measured distances, and the bed and lamps are placed from them.

**Architecture:**
- A pure layout module (`src/scene/mouldLayout.ts`) turns a run, the room and wall settings, and the bed's x into panel rectangles and slider limits. All clamping lives there, and it never changes saved settings.
- Wall definitions (`src/scene/mouldWalls.ts`) describe each wall's runs (sections) and rail segments.
- The bedroom and living moulding builders draw through one shared strip helper. The panel UI reads its slider limits from the same layout function.

**Tech Stack:** TypeScript, three.js, React 19, Vitest, Testing Library, Playwright (visual snapshots).

**Spec:** `docs/superpowers/specs/2026-11-23-wall-moulding-spacing-design.md`

## Global Constraints

**Spacing and rows**
- Spacing S is identical between columns, at run ends, above the skirting (`SKIRTING` = 0.18 m), under the ceiling (`CEILING` = 3.3 m), and both sides of the rail.
- Dado D is the **top** of the rail. The rail spans D − 0.04 … D.
- The lower row spans SKIRTING + S … D − 0.04 − S.
- The upper row spans D + S … CEILING − S.

**Ranges and minimums**
- Room S: 4–30 cm, default 8. Room D: 60–110 cm, default 77. A wall's S override has the same range; `null` means it follows the room.
- Column count: 1–10. A dresser section's count can be 0.
- `MIN_COL` = 0.2 m. `MIN_ROW` = 0.1 m.

**Clamping**
- Clamps change only what is drawn, never what is saved.
- Spacing is never reduced to make something fit.
- No setting changes another as a side effect, except one: lowering the count below the fixed column clears the fix.

**Fixed column**
- At most one fixed column per wall section.
- Its position is `'even' | 'bed' | 'custom'`. `'bed'` is offered on the bed wall only.

**Nightstands and bed**
- Nightstand: 0.40 W × 0.23 H × 0.30 D m, with its bottom at 0.48 m.
- Left nightstand: its left edge is 0.47 m from the window wall (x = −W/2).
- Right nightstand: its right edge is 0.55 m from the wardrobe fronts (x = W/2 − 0.58).
- `BEDX` is the midpoint of the two nightstand centres. The Adina lamps are centred on the nightstands' x, and the shade height stays `ADINA_SHADE_Y`.

**Defaults** (cm)

| Section | Columns | Fixed column |
|---|---|---|
| bed | 3 | 2, at 180, `'bed'` |
| dresserWindow | 1 | none |
| dresserMiddle | 0 | none |
| dresserCorner | 1 | none |
| sofa | 5 | none |
| tv | 3 | 2, at 170, `'even'` |

## Review Focus

1. **Designs saved before this change** (they have `mouldGap`/`mouldSofaGap`/`mouldSofaColumns` but no `mouldWalls`) load with the old gap as the room's S, the old sofa count, and new defaults for everything else. Tested in Task 3.
2. **A saved S that is too big for the saved D** (possible from storage, since sanitising only applies the slider ranges): a row that would be shorter than `MIN_ROW` is skipped, never drawn inverted. The other row and the columns still draw. Tested in Task 1.
3. **A saved count above what fits, with the fixed column beyond the drawn count:** that wall draws equal columns, and the saved `fixedColumn` is untouched. Tested in Task 1.
4. **Lowering the count in the panel** below the fixed column clears the fix, but raising S (which may reduce the drawn count) does not. Tested in Tasks 3 and 5.
5. **Dragging a slider on one wall rebuilds only that wall's meshes.** The dresser wall's three sections show and hide together with `mouldDresserWall`. Tested in Task 4.

---

### Task 1: Shared layout function

**Files:**
- Create: `src/scene/mouldLayout.ts`
- Test: `src/scene/mouldLayout.test.ts`

**Interfaces:**
- Consumes: `SKIRTING`, `CEILING` from `src/data/rooms.ts`.
- Produces (all lengths in metres unless the name says cm):
  ```ts
  export const RAIL_H = 0.04, MIN_COL = 0.2, MIN_ROW = 0.1;
  export type FixedPosition = 'even' | 'bed' | 'custom';
  /** one wall section's saved settings (cm) — the type lives here so the scene and state share it */
  export interface MouldWall {
    spacing: number | null; columns: number; fixedColumn: number; // 0 = none, else 1-based
    fixedWidth: number; fixedPosition: FixedPosition; fixedCentre: number; // custom: cm from the run's start
  }
  export interface MouldRoom { spacing: number; dado: number } // cm
  export interface Rows { rail: [number, number]; lower: [number, number] | null; upper: [number, number] | null }
  export interface SectionLayout {
    spacing: number;            // metres, the S actually used
    count: number;              // columns drawn
    fixed: { index: number; width: number; centre: number } | null; // drawn fixed column, 0-based index, absolute centre x
    columns: [number, number][];// absolute x
    rows: Rows;
    limits: {
      maxColumns: number;
      fixedWidth: { min: number; max: number } | null;  // cm, null when no fixed column is drawn
      fixedCentre: { min: number; max: number } | null; // cm from the run start
      spacingMax: number;                               // cm, cap for this wall's S at the room's D
    };
  }
  export function rows(spacing: number, dado: number): Rows;
  export function spacingMax(dado: number): number;               // metres
  export function dadoRange(spacing: number): { min: number; max: number }; // metres
  export function layoutSection(run: [number, number], room: MouldRoom, wall: MouldWall, bedX?: number): SectionLayout;
  ```

- [ ] **Step 1: Write the failing tests** in `src/scene/mouldLayout.test.ts`:
  - `rows(0.08, 0.77)` gives:
    - `rail` = [0.73, 0.77]
    - `lower` ≈ [0.26, 0.65]
    - `upper` ≈ [0.85, 3.22]
  - `rows(0.3, 0.77).lower` is `null`. Its `upper` is still a valid range.
  - `spacingMax(0.77)` ≈ 0.225, and `dadoRange(0.08)` ≈ { min: 0.54, max: 2.94 }. Both follow from requiring each row to be at least `MIN_ROW` tall.
  - **Rule sweep** (`it.each`):
    - Inputs: runs [0, 3.72] and [0, 1.59]; S in {4, 8, 15, 30} cm; D 77 cm; columns 1–10; fixed column none, 1, or the last; width 20, 100 and 500 cm; position `'even'`, or `'custom'` at 0, 50% and 100% of the run.
    - For every layout:
      - The first column starts at a + S, and the last ends at b − S.
      - Each gap between neighbours equals S, to 1e-9.
      - Every column is at least `MIN_COL` wide.
      - Each non-null row's distance to its neighbour (skirting, rail, ceiling) equals S.
  - **Bed wall default:** `layoutSection([-2.15, 1.57], {spacing: 8, dado: 77}, bedDefault, -0.33).columns` ≈ [[-2.07, -1.31], [-1.23, 0.57], [0.65, 1.49]]. The side columns are 0.76 and 0.84 wide.
  - **TV default:** run [3.69, 7.376], fixed column 2 at 170 cm `'even'`. The centre column spans ≈ [4.683, 6.383], which contains [4.85, 6.31].
  - **Clamping**, with the saved inputs unchanged in each case:
    - Columns 10 at S 30 cm on a 1.59 m run draw `limits.maxColumns` columns, which is 4.
    - A `fixedColumn` greater than the drawn count gives `fixed === null`.
    - `fixedWidth` 500 is drawn at `limits.fixedWidth.max`.
    - A custom centre of 0 is drawn at `limits.fixedCentre.min`.
  - Columns 0 gives `columns` = [] and still returns `rows`.

- [ ] **Step 2: Run the tests and check they fail.** Run `npx vitest run src/scene/mouldLayout.test.ts`. Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `src/scene/mouldLayout.ts`.**
  - `maxColumns` = floor((b − a − S) / (MIN_COL + S)), at least 0.
  - `fixedWidth.max` = b − a − (n + 1)·S − (n − 1)·MIN_COL.
  - With column k (1-based) centred at x, the clamp range is a + S + (k − 1)(MIN_COL + S) + w/2 … b − S − (n − k)(MIN_COL + S) − w/2. The columns on each side split their side equally.
  - `'bed'` uses `bedX`, falling back to `'even'` when `bedX` is undefined. `'custom'` uses a + fixedCentre/100.

- [ ] **Step 4: Run the tests and check they pass.** Run `npx vitest run src/scene/mouldLayout.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/scene/mouldLayout.ts src/scene/mouldLayout.test.ts && git commit -m "Add the shared moulding layout that keeps one spacing on every side"
  ```

### Task 2: Nightstands, bed and lamps placed by measured distances

**Files:**
- Modify: `src/scene/bedroom/dimensions.ts:9` (BEDX), and add the nightstand constants
- Modify: `src/scene/bedroom/bedside.ts` (the size, the fixed x, and remove `moveTo`)
- Modify: `src/scene/bedroom/index.ts:53-56` (stop wiring the tables to the moulding)
- Modify: `src/scene/bedroom/moulding.ts` (remove the `onTables` parameter and call; the layout is unchanged until Task 4)
- Modify: `src/scene/layout.ts` (drop `tableOffset`/`MIN_TABLE_OFFSET`/`BedWallLayout`, so `bedWallLayout` returns `wallLayout` over `HALF_SPAN`), and `src/scene/layout.test.ts` (drop the table-offset assertions)
- Test: `src/scene/bedroom/bedside.test.ts` (new)

**Interfaces:**
- Produces, in `dimensions.ts`:
  ```ts
  export const WARD_FRONT = W / 2 - 0.58;
  export const NIGHTSTAND = { w: 0.4, h: 0.23, d: 0.3, y0: 0.48 };
  export const NIGHTSTAND_X: readonly [number, number] = [-W / 2 + 0.47 + 0.2, WARD_FRONT - 0.55 - 0.2];
  export const BEDX = (NIGHTSTAND_X[0] + NIGHTSTAND_X[1]) / 2;
  ```
- `Bedside` loses `moveTo`, and its other members are unchanged.

- [ ] **Step 1: Write the failing tests** in `bedside.test.ts`:
  - `NIGHTSTAND_X` ≈ [-1.48, 0.82], and `BEDX` ≈ -0.33.
  - Build `buildBedside(kit(group), bedroomMaterials('#888888'))`. Each table's oak bounding box is 0.40 × 0.23 × 0.30 (±0.005), with `min.y` ≈ 0.48. Its left edge is 0.47 from −W/2 (left table), or its right edge is 0.55 from `WARD_FRONT` (right table).
  - `lamps[i]` x equals `NIGHTSTAND_X[i]`.
  - The headboard and each nightstand are separated by about 0.10 m. Use `buildBed`: the headboard's x extent is BEDX ± 0.845.

  Find the parts by material (`m.oak`) as `livingMoulding.test.ts` does.

- [ ] **Step 2: Run the tests and check they fail.** Run `npx vitest run src/scene/bedroom/bedside.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the changes.**
  - Rescale the table to `NIGHTSTAND`, keeping its parts in proportion. TOP = `y0 + h` = 0.71.
  - The lamp cord runs down to the new TOP.
  - Remove `moveTo` and the `onTables` plumbing.
  - The bed and rug already follow `BEDX`.

- [ ] **Step 4: Run the full test suite.** Run `npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add -A src/scene && git commit -m "Place the nightstands by their wall distances and centre the bed between them"
  ```

### Task 3: Settings for spacing, dado and per-wall columns

**Files:**
- Create: `src/state/mould.ts`
- Modify: `src/state/settings.ts` (types, `DEFAULTS`, `sanitizeBedroom`, `sanitizeLiving`)
- Test: `src/state/mould.test.ts`, `src/state/settings.test.ts`

The old fields (`mouldGap`, `mouldCentre`, `mouldSide`, `mouldSofaColumns`, `mouldSofaGap`) **stay for now**, so the scene and the panel still compile. Task 5 removes them.

**Interfaces:**
- Consumes: `MouldWall`, `FixedPosition` from `src/scene/mouldLayout.ts`.
- Produces, in `src/state/mould.ts`:
  ```ts
  export type BedroomSection = 'bed' | 'dresserWindow' | 'dresserMiddle' | 'dresserCorner';
  export type LivingSection = 'sofa' | 'tv';
  export const MOULD_SLIDERS = { spacing: { min: 4, max: 30, step: 1 }, dado: { min: 60, max: 110, step: 1 },
    columns: { min: 1, max: 10, step: 1 }, fixedWidth: { min: 20, max: 500, step: 1 } } as const;
  export const BEDROOM_MOULD_DEFAULTS: Record<BedroomSection, MouldWall>;
  export const LIVING_MOULD_DEFAULTS: Record<LivingSection, MouldWall>;
  export function sanitizeMouldWall(raw: unknown, d: MouldWall, opts: { minColumns: 0 | 1; allowBed: boolean }): MouldWall;
  /** set the count; clears the fixed column if it no longer exists */
  export function withColumns(w: MouldWall, columns: number): MouldWall;
  ```
- `BedroomSettings` gains `mouldSpacing: number; mouldDado: number; mouldWalls: Record<BedroomSection, MouldWall>`.
- `LivingSettings` gains the same fields, keyed by `LivingSection`.
- Defaults are as in Global Constraints. A wall with no fixed column has `fixedColumn: 0, fixedWidth: 100, fixedPosition: 'even', fixedCentre: 0`.

- [ ] **Step 1: Write the failing tests.**
  - `withColumns({...tv, fixedColumn: 2}, 1).fixedColumn === 0`, while `withColumns(tv, 4)` keeps 2.
  - `sanitizeMouldWall` behaviour:
    - It clamps S to 4–30, and keeps `null`.
    - It clamps columns to minColumns–10, rounded.
    - It sets `fixedColumn` to 0 when it is greater than columns.
    - It turns `'bed'` into `'even'` when `allowBed` is false.
    - It replaces junk with the defaults.
  - `sanitizeSettings({version: 2, bedroom: {mouldGap: 12}}).bedroom` has `mouldSpacing: 12`, and its `mouldWalls` equal the defaults. (Review Focus 1.)
  - `sanitizeSettings({version: 2, living: {mouldSofaGap: 14, mouldSofaColumns: 7}}).living` has `mouldSpacing: 14`, and `mouldWalls.sofa.columns` is 7.
  - A version-1 save (`mgap: 12`) also ends up with `mouldSpacing: 12`.
  - When `mouldWalls` is present, the legacy fields are ignored.
  - `mouldDado` is clamped to 60–110 and defaults to 77.

- [ ] **Step 2: Run the tests and check they fail.** Run `npx vitest run src/state`. Expected: FAIL.

- [ ] **Step 3: Implement the changes.** The legacy mapping applies only when `raw.mouldWalls` is absent.

- [ ] **Step 4: Run the tests and typecheck.** Run `npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/state && git commit -m "Add moulding spacing, dado height and per-wall column settings"
  ```

### Task 4: Draw every wall through the shared layout

**Files:**
- Create: `src/scene/mouldWalls.ts` (wall definitions) and `src/scene/mouldStrips.ts` (draws a `SectionLayout` as strips)
- Modify: `src/scene/bedroom/moulding.ts`, `src/scene/bedroom/index.ts`, `src/scene/livingMoulding.ts`
- Delete: `src/scene/bedroom/dimensions.ts` exports `RAIL_Y`, `LOW_Y0`, `LOW_Y1` once nothing uses them. Grep first: `bedside.ts` used `LOW_Y*` before Task 2.
- Test: `src/scene/bedroom/moulding.test.ts` (new), `src/scene/livingMoulding.test.ts` (update)

**Interfaces:**
- Consumes: `layoutSection`, `rows`, `SectionLayout`, `MouldRoom` (Task 1); the settings fields (Task 3); `BEDX`, `WARD_FRONT` (Task 2).
- Produces, in `mouldWalls.ts`:
  ```ts
  export interface MouldSectionDef<K extends string> { key: K; label: string; run: [number, number]; minColumns: 0 | 1; bedAnchor: boolean }
  export interface MouldWallDef<K extends string> { toggle: 'mouldBedWall' | 'mouldDresserWall' | 'mouldSofaWall' | 'mouldTvWall'; label: string; sections: MouldSectionDef<K>[]; rail: [number, number][] }
  export const BEDROOM_MOULD_WALLS: MouldWallDef<BedroomSection>[];
  export const LIVING_MOULD_WALLS: MouldWallDef<LivingSection>[];
  ```

  | Wall | Section | Run | Notes |
  |---|---|---|---|
  | Bed wall | `bed` | [−W/2, WARD_FRONT] | `bedAnchor` true |
  | Dresser wall | `dresserWindow` | [−W/2, MIRROR_X − MIRROR_HALF] | label "By the window" |
  | Dresser wall | `dresserMiddle` | [MIRROR_X + MIRROR_HALF, FRONT_DOOR_X0] | label "Mirror to door", `minColumns` 0 |
  | Dresser wall | `dresserCorner` | [FRONT_DOOR_X1, W/2] | label "Door to corner" |
  | Sofa wall | `sofa` | [3.69, 8.69] | |
  | TV wall | `tv` | [3.69, 7.376] | |

  Rails:
  - Bed wall: [[−W/2, W/2]].
  - Dresser wall: today's four segments. It stays broken behind the dresser, at `DRESSER_X` ± 0.4.
  - Sofa and TV walls: their run.

  The dresser sections other than `dresserMiddle` also have `minColumns` 0, so all three dresser sections allow 0 columns.
- In `mouldStrips.ts`: `drawSection(strip: (w: number, h: number, x: number, y: number, d?: number) => void, l: SectionLayout, frameT: number): void` draws a lower and an upper frame per column for the rows that aren't null. `drawRail(strip, segments, rows.rail)` draws the rail.
- The strip depths and wall z per wall stay as they are today.
- The dresser wall is no longer static. It is rebuilt on change, like the bed wall.

- [ ] **Step 1: Write the failing tests.** Use the strip-box helper from `livingMoulding.test.ts`; move it to `src/scene/testStrips.ts` and share it between the tests.
  - With the defaults, the bed wall's frame outer edges match the Task 1 bed default columns. The lower frames span y 0.26–0.65, and the upper frames span y 0.85–3.22.
  - The rail spans y 0.73–0.77.
  - Setting `mouldWalls.bed.spacing` to 12 changes only the bed wall's meshes. Setting `mouldSpacing` to 12 changes all bedroom walls that have no override.
  - Turning `mouldDresserWall` off hides all three sections' meshes. (Review Focus 5.)
  - Living room: the sofa wall's five columns meet the rule. The TV wall's centre column contains [4.85, 6.31].
  - Changing `living.mouldWalls.sofa` rebuilds only the sofa wall. This replaces the old `mouldSofaColumns`/`mouldCentre` assertions.

- [ ] **Step 2: Run the tests and check they fail.** Run `npx vitest run src/scene`. Expected: FAIL.

- [ ] **Step 3: Implement the changes.**
  - Each wall's rebuild key is `JSON.stringify` of its sections' `SectionLayout`s.
  - The bedroom passes `BEDX` as `bedX`.
  - `showFrom` keeps its camera rules for the bed and dresser parts.

- [ ] **Step 4: Run the tests and typecheck.** Run `npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add -A src/scene && git commit -m "Lay out every moulding wall with one spacing on all sides"
  ```

### Task 5: Moulding panel controls, and removing the old fields

**Files:**
- Modify: `src/components/MouldingSection.tsx`, `src/components/BedroomPanel.tsx:51-70`, `src/components/LivingPanel.tsx:24-45`
- Modify: `src/state/settings.ts`. Remove the old fields, `MouldLayout`, `SLIDERS` entries and `sanitizeMouldLayout`. Keep reading the legacy values in the Task 3 migration from `raw`.
- Delete: `src/scene/layout.ts`, `src/scene/layout.test.ts`
- Test: `src/components/App.test.tsx` (replace the moulding tests at lines 109–156)

**Interfaces:**
- Consumes: `BEDROOM_MOULD_WALLS`, `LIVING_MOULD_WALLS`, `layoutSection`, `dadoRange`, `withColumns`, `MOULD_SLIDERS`.
- `MouldingSection` props become `{ room: 'bedroom' | 'living'; walls: MouldWallDef<string>[]; settings; update }`. The panels pass the wall-definition list.

**UI**
- Keep the Colour and "Show on" groups as they are.
- **Room group** (`data-testid="<room>-mould-room"`):
  - "Spacing" slider. Its max is the smaller of 30 and `spacingMax(D)`·100.
  - "Dado height" slider. Its range is [60, 110] intersected with `dadoRange` at the largest effective S among the room's sections.
- **Section group:** one per section (`data-testid="mould-<sectionKey>"`), labelled with `<wall label>` for a single-section wall, or `<wall label>: <section label>` otherwise. It is greyed out with its wall's toggle. It contains:
  - **Spacing** slider: shows the effective S. Moving it sets the override. A "Use room spacing" button shows only while an override is set, and it sets `spacing: null`.
  - **Columns** slider: `minColumns`–10. Changes go through `withColumns`. When the drawn count is lower, the label shows `"5 (3 fit)"`.
  - **Fixed column** `<select>`: "None", "1"…"n".
  - **Fixed width** slider: range from `limits.fixedWidth`. Shown only when a fixed column is chosen.
  - **Position** chips: "Even", "Centred on bed" (only when `bedAnchor`), "Custom".
    - Choosing "Custom" seeds `fixedCentre` with the drawn centre, in cm from the run start.
    - With "Custom", a "Centre" slider follows, with its range from `limits.fixedCentre`.
- Every patch writes the room's whole `mouldWalls` object with one section replaced, because `applyPatch` merges shallowly.

- [ ] **Step 1: Write the failing tests** in `App.test.tsx`:
  - The bedroom "Spacing" slider in the room group sets `bedroom.mouldSpacing`.
  - "Dado height" sets `mouldDado`.
  - The bed wall's spacing sets `mouldWalls.bed.spacing`. "Use room spacing" then appears and resets it to `null`.
  - On the TV wall, setting Columns to 1 clears `fixedColumn`. (Review Focus 4.)
  - Setting the room's Spacing to its max does not change `living.mouldWalls.tv.fixedColumn`.
  - "Centred on bed" appears for the bed wall only.
  - Turning the bed wall off disables the bed section's controls and adds the `off` class.
  - Choosing "Custom" sets `fixedCentre` to the drawn centre.

- [ ] **Step 2: Run the tests and check they fail.** Run `npx vitest run src/components`. Expected: FAIL.

- [ ] **Step 3: Implement the panel and remove the old fields.** Check the old names are gone: `grep -rn "mouldGap\|mouldCentre\|mouldSide\|mouldSofa" src` should return only the migration in `settings.ts`.

- [ ] **Step 4: Run all the checks.** Run `npm test && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add -A src && git commit -m "Add spacing, dado and per-wall column controls to the moulding panel"
  ```

### Task 6: Visual check and snapshots

**Files:**
- Modify: `e2e/visual.spec.ts-snapshots/*.png` (intended changes)

- [ ] **Step 1: Run the app and look at it.**
  - Start the preview (`preview_start` from `.claude/launch.json`), then open the bedroom and the living room.
  - Check the bed wall:
    - Even gaps all round.
    - The centre panel is centred on the bed.
    - The nightstands are at 48 cm, with the lamps above them.
  - Check the dresser wall's three sections, and the sofa and TV walls.
  - Change Spacing, Dado and Columns, and the fixed column on the TV wall. Screenshot each.
- [ ] **Step 2: Run the smoke tests.** Run `npm run test:e2e`. Expected: PASS.
- [ ] **Step 3: Update the snapshots.** Run `npm run test:visual -- --update-snapshots`, then `npm run test:visual`. Expected: PASS.
- [ ] **Step 4: Check the snapshot changes.** Open the changed PNGs. Only moulding, nightstand, lamp and bed differences should appear.
- [ ] **Step 5: Commit**
  ```bash
  git add e2e && git commit -m "Update visual snapshots for the new moulding and nightstands"
  ```
