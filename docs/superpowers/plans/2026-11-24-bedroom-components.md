# Bedroom components (step 3) implementation plan

**Goal:** Give each bedroom piece its own switch, page and 3D target. Preserve the appearance of fresh rooms and every choice in a version 1–4 save.

**Architecture:** Use one definition per room and one saved `rooms` map. Each room owns its paint and component states. Only the bedroom owns an accent. The bedroom and living room keep their wall moulding settings. The product and cut list stays apartment-wide. Adding another bedroom-specific panel or keeping the old settings alongside the new ones would leave two owners for the same choice.

**Tech stack:** React, TypeScript, three.js, Vitest, Testing Library and Playwright.

**Spec:** [Rooms built from components](../specs/2026-11-24-menu-structure-design.md), step 3.

## Global constraints

- Keep the ten slots in the room tree. The vase, tray and tabletop lamp belong to Dresser. The mirror and painting do not. The vase, Accent pillows and artwork keep their existing accent response.
- Report actual visibility on Show or hide pieces. Hovering or focusing the overview row highlights nothing. Its individual switches still point at their pieces.
- Use the same room page for the hall. Omit the checklist and empty categories.
- Keep version 2 seeds in `e2e/helpers.ts`. Do not change 3D baselines. Commit locally and ask before publishing.

## Review focus

1. A bedroom pendant must never enter the catalog lamp builder. Switching off a bedside lamp pair or the dresser must extinguish its evening lights without affecting another light.
2. Camera cutaways must not bring back hidden artwork or mirrors. Hiding the wardrobes must expose a finished wall and floor.
3. A legacy `rug: 'none'` means hidden, not a missing product. Showing the rug again must restore a real product. Hidden pieces in version 5 must keep their product and options.
4. Painting art and frame must undo separately. Bulk visibility changes must undo together. The hall must never offer an empty checklist.

### Task 1: Close the shared step 2 review items

**Files:** `src/data/{components,living,office,roomDefs}.ts`, `src/state/{components,history,settings}.ts`, `src/scene/{roomLamps,roomLights}.ts`, `src/components/{componentTopic,Menu,roomPage}.tsx` and their tests.

- [x] Derive catalog lamp ownership from the definitions for both lamp placement and evening fill. Do not assume all component rooms have catalog lamps.
- [x] Make `OptionDef.initial` the only option default for initial state, sanitization and Reset. Patch and key each option separately. Ignore unrecognized component ids.
- [x] Remove the office-specific state type in `roomPage`. Keep the swatch column when its swatch is hidden. Pin the actual count and overview hover behavior.
- [x] Run the affected tests, type-check, review the task and commit.

### Task 2: Define the bedroom slots and separate the scene builders

**Files:** `src/data/{bedroom,components,catalog}.ts`, `src/state/components.ts`, `src/components/componentTopic.tsx`, `src/scene/bedroom/{bed,bedside,index}.ts` and their tests.

- [x] Define the ten slots with literal ids and existing product details. Add chips for pillows, art, frame and wardrobe colour. Retain rug thumbnails, sizes, links and stock information.
- [x] Split the bench from the bed before merging meshes. Split bedside tables from wall lamps before merging. Keep the bedside stand-off on the tables alone.
- [x] Check the fixed products and starting choices, both painting options, and the distinct meshes for the pairs. Review and commit. Register the bedroom and remove the legacy rug sentinel during the cutover.

### Task 3: Switch persistence, room pages and scene registration together

**Files:** `src/data/{catalog,roomDefs}.ts`, `src/state/{settings,history}.ts`, their UI and scene readers, `src/components/Panel.tsx`, `roomPage.tsx`, the old panel and menu helpers, `src/scene/bedroom/` and the associated tests.

- [x] Produce version 5 `rooms` and a mapped per-room patch. Walk the existing migration chain before moving paints and room settings. Map each old bedroom choice explicitly. Test old office ids, hidden living furniture and fabric, bedroom options, rug, pendant, wall paint, moulding and shopping settings.
- [x] Register and show all bedroom meshes by slot. Compose visibility with cutaways and evening light state. Keep dressing on its owner when hidden. Remove the `none` rug product.
- [x] Replace the per-room panels with the shared menu. Keep shopping pages, focus return, Reset, About and the four section headings where applicable. Keep accent under Room. Delete unused section and row routing.
- [x] Exercise every slot's click path and hide/show isolation, lamp lights, Reset, undo and save/reload. Run the unit suite, type-check and lint. Review and commit.

### Task 4: Verify the apartment and review the branch

- [x] Run `npm run test:e2e`. Run `npm run test:visual` without another 3D page rendering. Compare failures with main. Only the documented Wardrobe wall, day and Hall, day differences are expected.
- [x] Use a separate browser tab on the dev server. Inspect the exposed wardrobe wall. Check the dresser, bed and bench, evening lights, hover, saved options and Undo. Leave the user's tab and storage alone.
- [x] Update the spec with the completed decisions. Review the whole branch for lost settings, double lighting, click ownership and visual regressions. Record what was actually verified.

**Results:** Lint and type-check passed. All 11,460 unit tests passed with two workers. Under higher parallel load, the unchanged cutting optimiser sometimes exceeded its ten-second test deadline. Both smoke tests passed. The final visual run had 28 first-pass successes and eight passes on retry. Only the documented daytime wardrobe and hall views failed after retry. No snapshot or version 2 fixture changed.

The browser check showed continuous paint, skirting and floor behind the hidden wardrobes. Clicking the bed, bench, dresser and wall lamps opened their respective pages. Undo restored the previous pillow set and the previous nine visible pieces after Hide all. The hidden pendant and wardrobe choices survived reload. The in-app tab timed out after entering the bedroom, so these interactions ran in an isolated Playwright tab on the same dev server.
