# Living room components (step 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the living room onto the component model and give every room one menu structure: Room ·
Lighting · Furniture · Textiles and decor.

**Architecture:**
- **Generalise the step 1 model.** Components gain options, a `decor` category is added, and room definitions live in
  one registry with derived id types.
- **The living room moves onto it.** Its lamps, furniture, rug and sofa fabric become components, in settings
  version 4, migrated from versions 1–3.
- **One page builder** draws every component room's first page: a Room group, the component categories, then About.
  The bedroom keeps #21's panel until step 3, but its headings take the same names.

**Tech Stack:** React 19, TypeScript, three.js 0.187, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-menu-structure-design.md` (step 2, and the step 1 notes on #21).

## Global Constraints

- **Headings, in this order, in every room:** Room, Lighting, Furniture, Textiles and decor, then About the room
  last.
  - Room holds the room settings (Wall colour, Wall moulding where the room has it, Show or hide pieces).
  - A heading with no rows is left out.
- **Same component, same id and name in every room:**
  - `ceiling-light` "Ceiling light";
  - `floor-lamp` "Floor lamp";
  - `rug` "Rug" in the living room, `round-rug` "Round rug" in the office.
- **Rugs are `decor`.** The office's round rug leaves the Reading corner group, so Reading corner holds the reading
  chair and dresser.
- **Settings version 4.**
  - `sanitizeSettings` accepts versions 1–4, and nothing a user saved is lost.
  - Version 4 differs from version 3 in two places:
    - the living room's `hidden`, `pendant`, `floorLamp` and `sofaFabric` become `living.components`;
    - the office's `pendant` component is renamed `ceiling-light`.
  - Moulding fields stay where they are.
- **No 'none' anywhere.**
  - `PENDANTS`, `FLOOR_LAMPS`, `READING_CHAIRS`, `DRESSERS` and `ROUND_RUGS` lose their `'none'` entry.
  - `drawn()` and `lampIds()` go away; the scene reads `shown` and `variant`.
- **The default look is unchanged.** With default settings, and with migrated version 2 and 3 settings, every room
  looks exactly as before, and the existing visual snapshots pass. The living room's lamps start hidden, all its
  furniture shown, and the sofa in its original fabric.
- **Work on the existing branch** `room-components-step-2`, which is stacked on PR #22.

## Review Focus

1. **A version 3 save with the living room's sofa hidden and a Bemz fabric chosen.** After migration it must show
   the sofa hidden with that fabric kept, so showing it again brings the fabric back. → Task 2, `settings.test.ts`.
2. **A version 3 office save with a pendant chosen** must come back as `ceiling-light` with the same product, shown.
   → Task 2, `settings.test.ts`.
3. **A saved Bemz fabric code that left the catalog** falls back to `'original'` and keeps the sofa's switch. →
   Task 1, `components.test.ts`.
4. **Hovering the living room's Sofa row** lights up only the sofa, and the Rug row only the rug. Each living piece
   is now its own click target, not `['furniture']`. → Task 2, `createScene` tag test and `App.test.tsx`.
5. **Show all / Hide all on the living room page** is one undo step. → Task 3, `App.test.tsx`.

---

### Task 1: Generalise the component model

**Files:**
- Modify: `src/data/components.ts`, `src/state/components.ts`, `src/state/components.test.ts`,
  `src/components/componentTopic.tsx`, `src/components/componentTopic.test.tsx`, `src/data/office.ts`,
  `src/data/office.test.ts`
- Create: `src/data/roomDefs.ts`

**Interfaces:**
- Produces, in `src/data/components.ts`:
  ```ts
  export type Category = 'lighting' | 'furniture' | 'decor';
  export const CATEGORIES: readonly { id: Category; title: string }[]; // Lighting, Furniture, Textiles and decor, in that order
  export type OptionDef = { id: string; label: string; kind: 'fabric'; initial: string };
  // ComponentDef gains: category: Category; options?: readonly OptionDef[]; initial gains options?: Record<string, string>
  // ComponentState becomes { shown: boolean; variant: string; options: Record<string, string> }
  ```
- Produces, in `src/data/roomDefs.ts`:
  ```ts
  export const ROOM_DEFS = { office: OFFICE } as const; // living added in Task 2
  export type ComponentRoom = keyof typeof ROOM_DEFS;
  export type ComponentId<R extends ComponentRoom> = (typeof ROOM_DEFS)[R]['components'][number]['id'];
  ```
  `OFFICE` is declared `as const satisfies RoomDef`, so ids are literal types. `OfficeComponentId` becomes
  `ComponentId<'office'>`, and the hand-written union is deleted.
- Produces, in `src/components/componentTopic.tsx`:
  - `componentGroups` returns the categories in `CATEGORIES` order, with empty ones left out.
  - Options render through `optionControl(def: OptionDef, value: string, onChange: (v: string) => void): ReactNode`,
    and their summary through `optionSummary(def, value): { text: string; swatch?: string }`. For `'fabric'` these
    are `SofaFabricSection`'s picker and its "Bemz <family>, <colour>" / "Original fabric" text with the fabric's hex.
  - `SofaFabricSection` takes `{ value: string; onChange(code: string): void }` instead of `settings` and `update`.

- [ ] **Step 1: Write the failing tests.**
  - `components.test.ts`:
    - `sanitizeComponents` fills `options` from `initial.options` for missing or unknown option values;
    - a fabric option keeps a known Bemz code and turns an unknown one into `'original'` (Review Focus 3);
    - a v3-shaped entry with no `options` gets `{}` for a component that has no options.
  - `componentTopic.test.tsx`:
    - `componentGroups` on a room with one component in each of `decor`, `furniture` and `lighting` (defined in that
      order) returns the titles `['Lighting', 'Furniture', 'Textiles and decor']`;
    - a room with no `decor` component returns no "Textiles and decor".
  - `office.test.ts`: the `round-rug` has `category: 'decor'` and no group.
- [ ] **Step 2: Run** `npx vitest run src/state src/data src/components/componentTopic.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Options are validated per kind. `'fabric'` accepts `'original'` or a code in `BEMZ_FABRICS`; anything else takes
    the option's `initial`.
  - The page order inside `componentTopic` becomes switch, product list, option controls, note.
  - The summary is:
    - `'Hidden'` when hidden;
    - otherwise the option summary when the component has an option;
    - otherwise the variant's short name.

    The option summary's `swatch` becomes the row's swatch.
  - `Reset` also restores `initial.options`.
  - Make the office's `round-rug` `decor`, and delete its `group`.
  - Update `src/components/OfficePanel.tsx` only as far as it needs to compile.
- [ ] **Step 4: Run** `npx vitest run && npx tsc -b --noEmit && npx eslint src`. Expected: all PASS.
- [ ] **Step 5: Commit**: "Give components options and a decor category, and keep room definitions in one registry".

---

### Task 2: The living room as components, through settings, panel and scene

**Files:**
- Create: `src/data/living.ts`, `src/data/living.test.ts`
- Modify:
  - data: `src/data/roomDefs.ts`, `src/data/office.ts` (`pendant` → `ceiling-light`, name "Ceiling light");
  - state: `src/state/settings.ts`, `src/state/settings.test.ts`;
  - scene: `src/scene/createScene.ts`, `src/scene/furniture.ts`, `src/scene/furniture.test.ts`, `src/scene/roomLamps.ts`,
    `src/scene/roomLamps.test.ts`, `src/scene/roomLights.ts`, `src/scene/office/tags.test.ts`;
  - components: `src/components/LivingPanel.tsx`, `src/components/optionLabel.ts`, `src/components/App.test.tsx`;
  - e2e: none (`openWith` keeps seeding version 2, which exercises the migration).

**Interfaces:**
- Produces, in `src/data/living.ts`: `export const LIVING = { … } as const satisfies RoomDef`. Its components, in
  order:
  - `ceiling-light` (lighting): `PENDANTS` without `'none'`; starts hidden on the first real pendant.
  - `floor-lamp` (lighting): the same, from `FLOOR_LAMPS`.
  - `sofa` (furniture): one variant `{ id: 'nockeby', name: 'IKEA NOCKEBY' }`, with option
    `{ id: 'fabric', label: 'Fabric', kind: 'fabric', initial: 'original' }`.
  - `tv` "Frame TV", `tv-bench` "Sideboard", `shelving` "String shelving" and `plant` "Plant" (furniture): one variant
    each.
  - `rug` "Rug" (decor): one variant `{ id: 'quebec', name: 'ILVA Quebec, 250 × 350 cm' }`.

  Every piece starts shown, apart from the lamps. Notes come from today's living-room About text, one sentence per
  piece. The ids match `FURNITURE`'s ids, so `furniture.ts` keeps its lookups.
- Produces, in `src/state/settings.ts`:
  - `LivingSettings` loses `hidden`, `pendant`, `floorLamp` and `sofaFabric`, and gains
    `components: ComponentStates<ComponentId<'living'>>`.
  - `version: 4`.
  - A generic `applyPatch`, which merges each named component's fields, `options` included, for every room in
    `ROOM_DEFS`.
  - `SettingsPatch[room].components` is typed from `ComponentId<room>`.
- Produces, in `src/scene/furniture.ts`: `setShown(shown: (id: string) => boolean)` replaces `setHidden`.

- [ ] **Step 1: Write the failing tests.**
  - `living.test.ts`:
    - the id order is as above, and the categories are as above;
    - no `'none'` variant, and each piece starts on a variant it has;
    - the defaults: lamps hidden, everything else shown, fabric `'original'`.
  - `settings.test.ts`:
    - `it('migrates the version 3 living room')`. The input is
      `{ version: 3, living: { hidden: ['sofa', 'plant'], pendant: P, floorLamp: 'none', sofaFabric: F } }`.
      Expected:
      - `sofa` `{ shown: false, variant: 'nockeby', options: { fabric: F } }` (Review Focus 1);
      - `plant.shown` false;
      - `ceiling-light` `{ shown: true, variant: P }`;
      - `floor-lamp.shown` false;
      - the moulding fields unchanged.
    - `it('renames the office pendant')`: a v3 `office.components.pendant` `{ shown: true, variant: P }` becomes
      `ceiling-light` (Review Focus 2).
    - `it('reads version 4 as saved')`: `sanitizeSettings(DEFAULTS)` equals `DEFAULTS`, which has `version: 4`.
    - The existing v1 and v2 migration cases still pass, now ending at v4.
  - `roomLamps.test.ts`: the living room's lamps build from `living.components`, and are tagged `['ceiling-light']`
    and `['floor-lamp']` in both rooms.
  - `src/scene/furniture.test.ts` (Review Focus 4):
    - `it('tags each piece with its own component')`: `loadFurniture` with the file's existing stub loader. After
      `ready`, `optionOf(obj).path` is `[id]` for every `FURNITURE` id, and the sorted ids equal the `furniture` and
      `decor` component ids of `LIVING`, sorted.
    - `it('shows only the pieces switched on')` replaces the hidden-list cases and uses `setShown`.
  - `App.test.tsx`:
    - the living room's rows are
      `['Wall colour', 'Wall moulding', 'Show or hide pieces', 'Ceiling light', 'Floor lamp', 'Sofa', 'Frame TV',
      'Sideboard', 'String shelving', 'Plant', 'Rug', 'About the room']`;
    - the headings are Room, Lighting, Furniture and Textiles and decor;
    - picking a Bemz fabric on the Sofa page stores `living.components.sofa.options.fabric`;
    - the 3D click cases for the living room use the component ids;
    - hovering the Sofa row points at `['sofa']`.
- [ ] **Step 2: Run** `npx vitest run`. Expected: FAIL in the files above.
- [ ] **Step 3: Implement.**
  - **Settings:**
    - `fromVersion3(s)` runs after `fromVersion2Office` for v1 and v2 input, and on its own for v3. It maps the living
      fields (a `'none'` lamp is hidden; an unknown lamp id is hidden; `hidden` ids are hidden) and renames the
      office's `pendant`.
    - Version 4 is sanitized with `sanitizeComponents` for each room in `ROOM_DEFS`.
  - **Scene:**
    - `loadFurniture` tags each piece `tagOption([obj], 'living', [id])` itself, so the tagging moves out of
      `createScene`'s `onPiece`, which keeps only `fabric.attach`.
    - `createScene` sets the living furniture's visibility from `living.components`, and the fabric from
      `sofa.options.fabric`.
    - `roomLamps` reads `{ shown, variant }` per room from `ROOM_DEFS` rooms, with one code path for both rooms.
      Delete `lampIds`, and keep `drawn()` only until Task 4.
  - **Panel:** `LivingPanel` builds its menu like `OfficePanel`:
    - a Room group with `wallsTopic`, the moulding topic and Show or hide pieces;
    - then `componentGroups(LIVING, …)`;
    - About last.

    This duplication is removed in Task 3.
  - **`optionLabel`:** reads names from `ROOM_DEFS`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc -b --noEmit && npx eslint src`. Expected: all PASS.
- [ ] **Step 5: Commit**: "Keep the living room as components: lamps, furniture, rug and the sofa's fabric".

---

### Task 3: One page builder for every component room, and the same headings in the bedroom

**Files:**
- Create: `src/components/roomPage.tsx`
- Modify: `src/components/OfficePanel.tsx`, `src/components/LivingPanel.tsx`, `src/components/menuStructure.ts`,
  `src/components/App.test.tsx`
- Delete: `src/components/LampSection.tsx`, and `lampTopics` in `roomTopics.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function roomPage<R extends ComponentRoom>(args: {
    room: R; title: string; sub: string;
    settings: Settings; update: Update; menu: MenuNav;
    /** the room settings after Wall colour, before Show or hide pieces (the moulding topic) */
    roomRows?: Topic[];
    about: ReactNode;
    /** per component, a product thumbnail (the office's round rug) */
    thumbs?: Partial<Record<ComponentId<R>, (v: Variant) => string>>;
  }): Topic
  ```
  It returns the root topic:
  - groups `[Room: Wall colour, ...roomRows, Show or hide pieces]`, followed by `componentGroups`;
  - topics `[About the room]`.

  Show or hide pieces is today's office version made generic: count, Show all / Hide all, Reset to `initial.shown`,
  and hover pointing.

- [ ] **Step 1: Write the failing tests** in `App.test.tsx`:
  - The office's rows are `['Wall colour', 'Show or hide pieces', 'Ceiling light', 'Floor lamp', 'Cabinets', 'Desk',
    'Drawer unit', 'Desk chair', 'Reading chair', 'Dresser', 'Round rug', 'About the room']`. Its headings (level 2)
    are Room, Lighting, Furniture and Textiles and decor, and its level 3 headings are Workspace and Reading corner.
  - On the living room's Show or hide pieces page, Hide all then Undo restores every piece (Review Focus 5). Reset
    hides the lamps and shows the rest.
  - The bedroom's level 2 headings are `['Room', 'Lighting', 'Furniture', 'Textiles and decor']`.
- [ ] **Step 2: Run** `npx vitest run src/components/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `roomPage` takes over the bodies of `OfficePanel` and `LivingPanel`, which shrink to a `roomPage` call each.
  - In `menuStructure.ts`, rename the `walls` section's title to `'Room'` so the bedroom matches. Drop the rows no
    room uses any more (`ceiling`, `floorLamp`, `chair`, `sofa`) only if the bedroom does not use them; keep
    `ceiling` if `BedroomPanel` still uses it.
- [ ] **Step 4: Run** `npx vitest run && npx tsc -b --noEmit && npx eslint src`. Expected: all PASS.
- [ ] **Step 5: Commit**: "Draw every component room's page from one builder, under the same headings everywhere".

---

### Task 4: Remove 'none' from the catalogs

**Files:**
- Modify:
  - data: `src/data/catalog.ts`, `src/data/catalog.test.ts`, `src/data/office.ts`, `src/data/living.ts` (drop the
    filtering);
  - state: `src/state/components.ts` (delete `drawn`), `src/state/components.test.ts`;
  - scene: `src/scene/roomLamps.ts`, `src/scene/office/corner.ts`, `src/scene/office/corner.test.ts`.

- [ ] **Step 1: Change the tests.**
  - `catalog.test.ts`: assert that no list contains `'none'`, in place of "starts with none".
  - `corner.test.ts` and `roomLamps.test.ts`: build hidden pieces with `shown: false` only.
- [ ] **Step 2: Run** `npx vitest run src/data src/scene`. Expected: FAIL on `catalog.test.ts`.
- [ ] **Step 3: Implement.**
  - Remove the five `'none'` entries.
  - The lamps and the corner skip a piece when `!shown`, and otherwise draw `findById(list, variant)`.
  - Migration code that maps a saved `'none'` keeps working, because it compares strings, not catalog entries.
- [ ] **Step 4: Run** `npx vitest run && npx tsc -b --noEmit && npx eslint src`. Expected: all PASS.
- [ ] **Step 5: Commit**: "Drop the 'none' catalog entries: a hidden piece is how a room goes without one".

---

### Task 5: Verify in the app and against the snapshots

- [ ] **Step 1: Run** `npm run test:visual`, with no other 3D page rendering. Expected:
  - every snapshot matches, including "Living room, with lamps" and the two Bemz fabric snapshots, which load
    version 2 settings through the migration;
  - "Wardrobe wall, day" and "Hall, day" fail as they do on main, and only those two.
- [ ] **Step 2: Run** `npm run test:e2e`. Expected: PASS.
- [ ] **Step 3: Click through in the browser.** In the living room:
  - hover each row; each piece lights up on its own;
  - hide and show the sofa; its fabric comes back;
  - pick a fabric, then Undo;
  - Show or hide pieces: Hide all, then Undo;
  - choose a ceiling light in the evening; it lights the room.

  In the office, check the new heading order, and that the round rug is under Textiles and decor. In the bedroom,
  check the Room heading. Check the console for errors.
- [ ] **Step 4: Update the spec.** Mark step 2 as done under "Plan in steps", and note the round-rug ruling and the
  `ceiling-light` rename.
- [ ] **Step 5: Commit**: "Mark step 2 of the room components work as done".
