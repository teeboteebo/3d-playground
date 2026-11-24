# Office components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the component model and move the office onto it. Every office piece becomes its own component,
with its own switch, page and click target, gathered under the Workspace and Reading corner groups.

**Architecture:**
- The office is described by a `RoomDef` (static data): its components, their variants, their groups and notes.
- Its saved state becomes `office.components`: `{ shown, variant }` per component, in settings version 3, migrated
  from version 2.
- A generic `componentTopic` builds each piece's menu page. `Menu` gains headed row groups.
- The scene reads each piece's state to show, hide or swap it, and tags each piece with its own click path.

The living room and bedroom are untouched; they follow in steps 2 and 3 of the spec.

**Tech Stack:** React 19, TypeScript, three.js 0.187, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-menu-structure-design.md` (step 1 of "Plan in steps").

## Global Constraints

- **One room at a time.** Only the office moves to components in this plan. `bedroom`, `living` and `walls` keep their
  version 2 shapes inside version 3 settings.
- **Settings shape.** Settings become `version: 3`.
  - `sanitizeSettings` accepts version 1, 2 and 3 input; nothing a user saved is lost.
  - Version 3 differs from version 2 only in `office`.
  - The spec's full `rooms: Record<RoomId, RoomState>` shape is reached in step 3. Options (`options` in
    `ComponentState`) arrive in step 2, with the first component that has any; the office has none.
- **No 'none' variants for the office.** "None" becomes `shown: false`.
  - The office's variants are its catalogs with the `'none'` entry filtered out.
  - The catalogs themselves keep their `'none'` entries until step 2, when the living room's lamps move over. That way
    the scene code that still reads ids can be given `'none'` for a hidden piece.
- **Group names.** "Workspace" and "Reading corner", under the category headings "Room", "Furniture" and "Lighting".
- **Lamps hide their light too.** Hiding a lamp removes its light as well as its shape.
- **Default look unchanged.** With default settings, and with migrated version 2 settings, the 3D scene looks exactly
  as before. The existing visual snapshots must pass unchanged.
- **Work on a branch.** Use `office-components`, not `main`.

## Review Focus

1. **A version 2 save with a lamp chosen in the office** must come back with that lamp shown and selected. The e2e
   "Office, with lamps" snapshot loads exactly this. → Task 3, `settings.test.ts`.
2. **A version 3 save naming a product that has left the catalog** must keep the piece's switch and fall back to the
   default product, not crash or hide the piece. → Task 3, `components.test.ts`.
3. **Picking a product for a hidden piece** should show it. Otherwise the click looks like it did nothing. → Task 2,
   `App.test.tsx`.
4. **Coming back up from a piece's page inside a group** must return focus to that piece's row, as it does for flat
   rows today. → Task 1, `App.test.tsx`.
5. **Hiding a lamp in the evening** must turn its light off as well as remove its shape. → Task 3, `roomLamps.test.ts`.

---

### Task 1: Headed row groups in `Menu`

**Files:**
- Modify: `src/components/Menu.tsx`
- Test: `src/components/App.test.tsx` (focus and lookup through groups, exercised once the office uses groups in
  Task 2; this task adds a unit test of its own)
- Create: `src/components/Menu.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  /** a heading over rows on a page; one level of sub-groups inside it */
  export interface TopicGroup { title: string; topics: Topic[]; groups?: TopicGroup[] }
  // added to Topic:
  /** rows under headings, shown after `topics` */
  groups?: TopicGroup[];
  ```
  The path lookup, the opening of a row and the focus return all search `topics` and every topic in `groups`, to any
  depth.

- [ ] **Step 1: Write the failing tests** in `src/components/Menu.test.tsx`. Render `<Menu>` with a root whose
  `groups` are:

  ```ts
  [
    { title: 'Room', topics: [walls] },
    { title: 'Furniture', topics: [cabinets], groups: [{ title: 'Reading corner', topics: [chair] }] },
  ]
  ```

  where each topic is `{ id, title, summary, content: <p>{id} page</p> }`. Then:
  - `it('shows each group under its heading')`:
    - `getByRole('heading', { level: 2, name: 'Room' })` and `{ level: 2, name: 'Furniture' }` exist;
    - `getByRole('heading', { level: 3, name: 'Reading corner' })` exists;
    - `getByRole('list', { name: 'Reading corner' })` holds one button, whose `strong` is `Reading chair`.
  - `it('opens a row inside a sub-group')`: with `nav.path = ['chair']`, the text "chair page" is shown and the h1 is
    `Reading chair`.
  - `it('returns focus to the row in a sub-group')`: render at `['chair']`, click "Back to …", rerender with the path
    that `go` received. The `Reading chair` row button has focus.

- [ ] **Step 2: Run** `npx vitest run src/components/Menu.test.tsx`. Expected: FAIL, because `groups` is not rendered.

- [ ] **Step 3: Implement.** Add `TopicGroup` and `Topic.groups` to `src/components/Menu.tsx`.
  - Add `childTopics(page: Topic): Topic[]`, which flattens `topics` and groups recursively. Use it in the `trail`
    lookup.
  - Render each group as `<section><h2>{title}</h2><ul className="topics" aria-label={title}>…</ul>{sub-groups with
    h3}</section>`, using the same row button markup as today. Move the row button into a local `Row` component.
  - The focus-return query runs over a ref on a wrapper `div` around all row lists, instead of the single `ul`.
  - Swatch alignment (`swatches`) is decided per list.

- [ ] **Step 4: Run** `npx vitest run src/components`. Expected: all PASS. Existing pages have no `groups`, so they
  render unchanged.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/Menu.tsx src/components/Menu.test.tsx
  git commit -m "Let a menu page list its rows under headings, one level of sub-groups deep"
  ```

---

### Task 2: Component model, office definition and component pages

**Files:**
- Create: `src/data/components.ts`, `src/data/office.ts`, `src/data/office.test.ts`, `src/components/componentTopic.tsx`

**Interfaces:**
- Produces, in `src/data/components.ts`:
  ```ts
  export interface Variant<S = unknown> { id: string; name: string; vendor?: string; price?: string; stock?: string; st?: StockState; url?: string; shape?: S }
  export interface ComponentDef { id: string; name: string; category: 'furniture' | 'lighting'; group?: string; note?: string; variants: readonly Variant[]; initial: { shown: boolean; variant: string } }
  export interface RoomDef { id: RoomId; groups?: readonly { id: string; name: string }[]; components: readonly ComponentDef[] }
  export interface ComponentState { shown: boolean; variant: string }
  ```
- Produces, in `src/data/office.ts`:
  - `export const OFFICE: RoomDef`;
  - `export type OfficeComponentId = 'cabinets' | 'desk' | 'drawers' | 'desk-chair' | 'reading-chair' | 'dresser' | 'round-rug' | 'pendant' | 'floor-lamp'`;
  - `export const officeDef = (id: OfficeComponentId): ComponentDef`.
- Produces, in `src/components/componentTopic.tsx`:
  ```ts
  export function componentTopic(def: ComponentDef, state: ComponentState, set: (patch: Partial<ComponentState>) => void, thumb?: (v: Variant) => string): Topic
  /** the room's Furniture and Lighting groups, with each component in its group */
  export function componentGroups(room: RoomDef, topic: (def: ComponentDef) => Topic): TopicGroup[]
  ```

- [ ] **Step 1: Write the failing test** `src/data/office.test.ts`:
  - `it('lists the office pieces in order')`: `OFFICE.components.map((c) => c.id)` equals
    `['cabinets', 'desk', 'drawers', 'desk-chair', 'reading-chair', 'dresser', 'round-rug', 'pendant', 'floor-lamp']`.
  - `it('groups the workspace and the reading corner')`:
    - `OFFICE.groups` equals `[{ id: 'workspace', name: 'Workspace' }, { id: 'corner', name: 'Reading corner' }]`;
    - `desk`, `drawers` and `desk-chair` have `group: 'workspace'`;
    - `reading-chair`, `dresser` and `round-rug` have `group: 'corner'`;
    - `cabinets` has no group;
    - `pendant` and `floor-lamp` have `category: 'lighting'`, and all others have `'furniture'`.
  - `it('starts each piece on a variant it has')`: for every component, `variants.some((v) => v.id === initial.variant)`.
    No variant has the id `'none'`. Ids are unique.
  - `it('keeps today\'s default office')`:
    - the lamps start `{ shown: false }`, on `PENDANTS[1].id` and `FLOOR_LAMPS[1].id`;
    - the corner pieces start `{ shown: true }`, on `READING_CHAIRS[1].id`, `DRESSERS[1].id` and `ROUND_RUGS[1].id`
      (the first real product, as `DEFAULTS.office` has today);
    - the four fixed pieces start shown, with one variant each.

- [ ] **Step 2: Run** `npx vitest run src/data`. Expected: FAIL, because `office.ts` does not exist.

- [ ] **Step 3: Implement** `src/data/components.ts` and `src/data/office.ts`.
  - **Variants:**
    - the corner pieces and the lamps use `READING_CHAIRS`, `DRESSERS`, `ROUND_RUGS`, `PENDANTS` and `FLOOR_LAMPS`,
      with `'none'` filtered out;
    - each fixed piece has one variant: `{ id: 'metod', name: 'IKEA METOD' }`, `{ id: 'idasen', name: 'IKEA IDÅSEN' }`,
      `{ id: 'idasen-drawers', name: 'IKEA IDÅSEN drawer unit' }`, `{ id: 'alefjall', name: 'IKEA ALEFJÄLL, beige' }`.
  - **Names:** Cabinets, Desk, Drawer unit, Desk chair, Reading chair, Dresser, Round rug, Ceiling pendant, Floor lamp.
  - **Notes:**
    - the four fixed pieces: split today's `OfficePanel` furniture note sentence by sentence, keeping its sizes;
    - the corner pieces: "A simplified shape. Prices and stock were checked on ${CORNER_CHECKED} and change often.";
    - the lamps: the same sentence, with `LAMPS_CHECKED`.

- [ ] **Step 4: Run** `npx vitest run src/data`. Expected: PASS.

- [ ] **Step 5: Implement `componentTopic` and `componentGroups`** in `src/components/componentTopic.tsx`. The
  `Topic` it returns:
  - **Ids and summary:** `{ id: def.id, title: def.name, summary }`. The summary is `'Hidden'` when the piece is not
    shown; otherwise it is the chosen variant's name up to its first comma.
  - **A switch:** `<button type="button" role="switch" className="chip" aria-checked={shown}>Show in room</button>`.
    Clicking it calls `set({ shown: !shown })`.
  - **A product list,** only when there are 2 or more variants: `<ProductList label={def.name} …>` with
    meta `` `${vendor} · ${price}` `` and the optional `thumb`. Picking a variant calls
    `set({ variant: id, shown: true })`.
  - **The note,** as `<p className="note">`.

  `componentGroups` returns `[{ title: 'Furniture', … }, { title: 'Lighting', … }]`:
  - ungrouped components are the group's `topics`, in definition order;
  - grouped components go into `groups`, in the order of `room.groups`;
  - empty groups and categories are left out.

  These are tested through the office menu in Task 3.

- [ ] **Step 6: Run** `npx tsc -b --noEmit && npx vitest run && npx eslint .`. Expected: no errors and all PASS.
  Nothing uses the new code yet.

- [ ] **Step 7: Commit**

  ```bash
  git add src/data src/components/componentTopic.tsx
  git commit -m "Describe the office as components, and build a menu page for any component"
  ```

---

### Task 3: Office settings as components, through the menu and the scene

The settings shape, its readers and the office panel change together, since none of them compiles without the others.

**Files:**
- Create: `src/state/components.ts`, `src/state/components.test.ts`
- Modify:
  - `src/state/settings.ts`, `src/state/settings.test.ts`;
  - `src/scene/office/corner.ts`, `src/scene/office/corner.test.ts`;
  - `src/scene/roomLamps.ts`, `src/scene/roomLamps.test.ts`;
  - `src/components/OfficePanel.tsx`, `src/components/roomTopics.tsx`, `src/components/LightingSection.tsx`
    (narrow both lighting helpers to `room: 'living'`);
  - `src/components/App.test.tsx`.
- Delete: `src/components/ReadingCornerSection.tsx`

**Interfaces:**
- Consumes: `OFFICE`, `OfficeComponentId`, `ComponentState` (Task 2); `componentTopic` and `componentGroups`
  (Task 2); `TopicGroup` (Task 1).
- Produces, in `src/state/components.ts`:
  ```ts
  export type ComponentStates<K extends string> = Record<K, ComponentState>;
  export function componentDefaults<K extends string>(room: RoomDef): ComponentStates<K>
  /** each component's saved state, any invalid or missing field taken from its definition's initial state */
  export function sanitizeComponents<K extends string>(raw: unknown, room: RoomDef): ComponentStates<K>
  /** the product to draw, or 'none' for a hidden piece: the bridge for scene code written around 'none' */
  export function drawn(state: ComponentState): string
  ```
- Produces, in `src/state/settings.ts`:
  - `Settings.version: 3` and `Settings.office: { components: ComponentStates<OfficeComponentId> }`;
  - `SettingsPatch.office?: { components?: Partial<Record<OfficeComponentId, Partial<ComponentState>>> }`.
    `applyPatch` merges each named component's fields into its current state.

- [ ] **Step 1: Write the failing tests.**

  `src/state/components.test.ts`:
  - `it('starts every component at its initial state')`: `componentDefaults(OFFICE)['reading-chair']` equals
    `{ shown: true, variant: READING_CHAIRS[1].id }`.
  - `it('keeps the switch and falls back to the initial product for an unknown one')`: for both `'gone'` and `'none'`,
    `sanitizeComponents({ 'reading-chair': { shown: false, variant } }, OFFICE)['reading-chair']` equals
    `{ shown: false, variant: READING_CHAIRS[1].id }`.
  - `it('ignores unknown components and non-boolean switches')`: input `{ sofa: {}, desk: { shown: 'no' } }`. There is
    no `sofa` key, and `desk.shown` is `true`.
  - `it('draws nothing for a hidden piece')`: `drawn({ shown: false, variant: 'x' })` is `'none'`, and
    `drawn({ shown: true, variant: 'x' })` is `'x'`.

  `src/state/settings.test.ts`: replace the office cases at lines 132–173 with these.
  - `it('migrates the version 2 office')`: `sanitizeSettings({ version: 2, office: { pendant: P, floorLamp: 'none',
    readingChair: 'none', dresser: D2, roundRug: 'gone' } }).office.components` has:
    - `pendant` `{ shown: true, variant: P }`;
    - `floor-lamp` `{ shown: false, variant: FLOOR_LAMPS[1].id }`;
    - `reading-chair` `{ shown: false, variant: READING_CHAIRS[1].id }`;
    - `dresser` `{ shown: true, variant: D2 }`;
    - `round-rug` `{ shown: true, variant: ROUND_RUGS[1].id }`.
  - `it('reads version 3 as saved')`: `sanitizeSettings(DEFAULTS)` equals `DEFAULTS`, and `DEFAULTS.version` is `3`.
  - `it('merges a patch into one component')`:
    `applyPatch(DEFAULTS, { office: { components: { desk: { shown: false } } } }).office.components` equals the
    defaults with only `desk.shown` false.
  - Keep the bedroom, living and walls cases unchanged; they must still pass with `version: 3` output.

  `src/scene/roomLamps.test.ts`, `src/scene/office/corner.test.ts`: change the `withLamps`, `settings` and `NONE`
  builders to set `office.components` (for example `NONE` becomes the three corner pieces with `shown: false`).
  Keep every assertion. Add to `roomLamps.test.ts`:
  - `it('turns off a hidden office lamp\'s light in the evening')`: apply `time: 'eve'` with the pendant shown, then
    with it hidden. `office-pendant` and `office-pendant-light` are no longer in the scene.

  `src/components/App.test.tsx`:
  - Make `rowTitles` gather every `[data-topic]` button on the page, in order.
  - `lists the other rooms' options`: the office's titles are `['Walls', 'Cabinets', 'Desk', 'Drawer unit',
    'Desk chair', 'Reading chair', 'Dresser', 'Round rug', 'Ceiling pendant', 'Floor lamp']`. Headings `Room`,
    `Furniture` and `Lighting` (level 2) and `Workspace` and `Reading corner` (level 3) are present.
  - Replace `shows the office with its furniture note` with:
    - `it('describes a fixed office piece on its own page')`: `goTo('Desk')` shows `/IDÅSEN desk/`, a
      `Show in room` switch, and no product list group.
  - Change the `lighting in the %s` describe to living only. Add `describe('office pieces')` with:
    - `it.each` over `['Reading chair', READING_CHAIRS, 'reading-chair']`, `['Dresser', DRESSERS, 'dresser']`,
      `['Round rug', ROUND_RUGS, 'round-rug']`, `['Ceiling pendant', PENDANTS, 'pendant']` and
      `['Floor lamp', FLOOR_LAMPS, 'floor-lamp']`: `goTo(name)`, then click `items[2]` in the group named `name`.
      `lastApplied().office.components[id]` equals `{ shown: true, variant: items[2].id }`, and so does `stored()`. The
      group lists `items.length - 1` products, with no "none".
    - `it('hides a piece and says so on its row')`: `goTo('Reading chair')`, then click the `Show in room` switch.
      `components['reading-chair'].shown` is `false` and `components.dresser.shown` is still `true`. Then
      `up('Office')`; `row('Reading chair')` has the text `Hidden` and has focus. This covers Review Focus 4.
    - `it('shows a hidden piece when a product is picked')`: start with `stored` version 3 settings where `pendant` is
      hidden. Pick `PENDANTS[2]`; `components.pendant` becomes `{ shown: true, variant: PENDANTS[2].id }`.
    - `it('does not pick a product when its shop link is clicked')`: keep today's link test, against `Reading chair`.

- [ ] **Step 2: Run** `npx vitest run`. Expected: FAIL in all the files above.

- [ ] **Step 3: Implement `src/state/components.ts`.** `sanitizeComponents` iterates `room.components`; an unknown key
  in `raw` is dropped.

- [ ] **Step 4: Implement the settings change** in `src/state/settings.ts`.
  - Remove `OfficeSettings` and `sanitizeOffice`. `DEFAULTS.office` is `{ components: componentDefaults(OFFICE) }`.
  - Add `fromVersion2Office(o: Raw): Raw`, which maps the five version 2 fields to `components` entries: `'none'` (or
    an unknown id) becomes `shown: false` on the initial variant, and any other id becomes `{ shown: true, variant: id }`.
  - In `sanitizeSettings`, version 1 and 2 input pass through it before `sanitizeComponents`.
  - `perRoom`'s legacy `office ?? end` lookup stays as it is.

- [ ] **Step 5: Implement the scene readers.**
  - **`corner.ts`:** reads each piece's id as `drawn(s.office.components[id])`; the `findById` lookup stays as it is.
    Tag each piece with its own path: `['reading-chair']`, `['dresser']` and `['round-rug']`.
  - **`roomLamps.ts`:** add `lampIds(s: Settings, room: LampRoom): { pendant: string; floorLamp: string }`.
    - The living room returns `s.living` as today.
    - The office returns `drawn()` of its `pendant` and `floor-lamp`.
    - The office's tags become `['pendant']` and `['floor-lamp']`; the living room's stay `['lighting']`.

- [ ] **Step 6: Implement the panel.**
  - **`OfficePanel.tsx`:** builds its root with `groups: [{ title: 'Room', topics: [wallsTopic(…)] },
    ...componentGroups(OFFICE, (def) => componentTopic(def, components[def.id], set, thumb))]`. Here
    `set = (patch) => update({ office: { components: { [def.id]: patch } } })`, and `thumb` returns
    `roundRugThumbnail(shape.pattern)` for the `round-rug` component only.
  - Delete `ReadingCornerSection.tsx`, and narrow `lightingTopic` and `LightingSection` to the living room.

- [ ] **Step 7: Run** `npx tsc -b --noEmit && npx vitest run && npx eslint .`. Expected: no errors, all PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add -A src
  git commit -m "Keep the office as components: each piece has its own switch, product and page"
  ```

---

### Task 4: Office pieces in 3D: one click target each, shown and hidden

**Files:**
- Modify:
  - `src/scene/office/index.ts`, `src/scene/office/office.test.ts`;
  - `src/components/optionLabel.ts`, `src/components/Stage.tsx:64`;
  - `src/components/App.test.tsx`.

**Interfaces:**
- Consumes: `Settings.office.components` (Task 3); `OFFICE` (Task 2).
- Produces: `optionLabel(room: RoomId, path: readonly string[]): string`. For a room with a `RoomDef`, the first path
  id is looked up as a component name first.

- [ ] **Step 1: Write the failing tests.**

  `src/scene/office/office.test.ts`:
  - `it('tags each fixed piece with its own page')`: `optionOf(g.getObjectByName(name))!.path` is:
    - `['cabinets']` for `office-cabinets`;
    - `['desk']` for `office-desk`;
    - `['drawers']` for `office-drawers`;
    - `['desk-chair']` for `office-chair`.
  - `it('hides only the piece that is switched off')`: apply DEFAULTS with `desk.shown: false`. `office-desk` has
    `visible === false`, and the other three are visible. Apply DEFAULTS again; the desk is visible again.

  `src/components/App.test.tsx`, in `clicking options in 3D`:
  - Replace the three office rows of the `it.each` with:
    - `['office', ['cabinets'], 'Cabinets']`;
    - `['office', ['desk'], 'Desk']`;
    - `['office', ['drawers'], 'Drawer unit']`;
    - `['office', ['desk-chair'], 'Desk chair']`;
    - `['office', ['reading-chair'], 'Reading chair']`;
    - `['office', ['dresser'], 'Dresser']`;
    - `['office', ['round-rug'], 'Round rug']`;
    - `['office', ['pendant'], 'Ceiling pendant']`;
    - `['office', ['floor-lamp'], 'Floor lamp']`.
  - `it('names an office piece under the mouse')`: `renderIn('office')`, then `hover3d('office', ['round-rug'])`; the
    label reads `Round rug`.

- [ ] **Step 2: Run** `npx vitest run src/scene/office src/components`. Expected: FAIL. The office pieces are still
  tagged `['furniture']`, and `optionLabel` returns the raw id.

- [ ] **Step 3: Implement.**
  - In `office/index.ts`, `piece(name, id: OfficeComponentId, build)` tags with `[id]` and keeps the group in a
    `Record` keyed by id. `apply` sets each group's `visible` from `s.office.components[id].shown`.
  - Change `optionLabel` to take the room, and pass `hover.option.room` from `Stage.tsx`.
  - Remove `furniture` and `corner` from `TITLES` only if no room still uses them. The living room still uses
    `furniture`, so `corner` goes and `furniture` stays.

- [ ] **Step 4: Run** `npx tsc -b --noEmit && npx vitest run`. Expected: all PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/scene/office src/components
  git commit -m "Give each office piece its own click target and let it be hidden"
  ```

---

### Task 5: Verify in the app and against the snapshots

**Files:**
- Modify: `docs/superpowers/specs/2026-11-24-menu-structure-design.md`. Under "Plan in steps", mark step 1 as done and
  note the two deviations:
  - the version 3 settings carry only the office as components until step 3;
  - the catalogs' `'none'` entries are removed in step 2.

- [ ] **Step 1: Run** `npm run test:visual`. Expected: every snapshot passes unchanged, including both
  "Office, with lamps" snapshots, which load version 2 settings through the migration. A changed 3D snapshot is a bug
  in Task 3 or Task 4, not a baseline to update.

- [ ] **Step 2: Run** `npm run test:e2e`. Expected: PASS.

- [ ] **Step 3: Check the hidden cabinets by eye.**
  - Start the dev server, open the Office and hide Cabinets.
  - Expected: plain wall, skirting and floor where they stood, with no gap, hole or z-fighting.
  - If it looks wrong, stop and report it. The spec's fallback is to mark the cabinets as not hideable, and that is
    the user's call.

- [ ] **Step 4: Click through the office in the app.**
  - Click each of the nine pieces in 3D; each one opens its own page.
  - Hide and show the reading chair; only the chair disappears and comes back.
  - Choose a pendant in the evening; it lights up. Hide it; its light goes out.

- [ ] **Step 5: Commit**

  ```bash
  git add docs/superpowers/specs/2026-11-24-menu-structure-design.md
  git commit -m "Mark step 1 of the room components work as done"
  ```
