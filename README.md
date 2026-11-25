# Apartment Playground

Interactive 3D model of an apartment, decoded from a SketchUp model. Click a piece in the bedroom, living room or
office to open its page. Change its options, try a different product where available, or hide it without losing
your choices. Each room has its own wall colour. Day and evening lighting are shared across the apartment.

Built with React, TypeScript, Vite and three.js.

Live: https://teeboteebo.github.io/3d-playground/

## Group pieces in a room

Open **Group pieces** in a room. Check two or more pieces and choose **Group selected**. You can also Shift-click
pieces in the 3D view. Name the group with **Rename**. Click any member in the room to select its group.
Selecting a piece in 3D or opening its options in the menu outlines it. Selecting a group outlines all its visible members.
Use **Enter** to work inside the group and **Options** to edit a single piece. **Leave group** or Escape goes back
one level.

A physical group can hold pieces or other groups. For example, group the office desk and drawers, then group that
desk set with a chair. **Ungroup** removes one level, so the desk set stays intact. Neither action moves any furniture.
Each piece keeps its product, finish, and visibility. Undo and redo apply to group edits too.

The bedroom starts with two bedside tables in one group and two wall lamps in another. Each left and right piece
has its own identity. The office headings **Workspace** and **Reading corner** still organize the catalog; they do
not bind pieces together.

## Move a piece or group

Select a piece or group in the room or its menu, then drag the outlined piece or any member of the selected group.
Dashed lines show its distances to the room in centimetres only while you drag. Release to place it, or press
Escape to cancel. Drag anywhere else to orbit. Use **Room plan** to check distances without moving anything.

Floor pieces slide across the floor. Wall pieces slide along their wall and can move up or down unless they also
rest on the floor. Use **Mounting wall** and **Change wall** to attach a piece to a different wall. Ceiling lights
stay fixed. Every member of a group must fit, including hidden members. A solid overlap warns but allows the
drop. Leaving the room or mounting across an opening blocks it.

For a precise move, set **Step (cm)** under **Fine adjustment** in the selection's panel and use the adjustment buttons.
Each drop, adjustment, or wall change is one undo step. Reloading restores the saved positions.

## Read the room plan

Open **Room plan** for the top-down view. Choose a numbered **Wall** to face it from inside the room.
The wall view shows its doors, windows and doorways. Numbered boxes show each piece’s projected width and height.
Freestanding pieces appear where they project onto the wall’s width; mounted pieces appear only on their own wall.
Open edges have no wall view.

Select a piece or group to see its clearances. In a wall view the dashed lines measure to the sides, floor and ceiling.
The list gives the distance back to the wall. Switch views to follow the same selection, or enter a group to inspect one
member. All views are read-only; **Back to 3D** returns without changing the layout.

## Develop

```bash
npm ci
npm run dev          # http://localhost:5173/3d-playground/
npm test             # Vitest unit + component tests
npm run lint
npm run typecheck
npm run build        # outputs dist/
npm run test:e2e     # Playwright: the app loads and draws the scene (runs in CI)
npm run test:visual  # Playwright: every camera view, day and evening, against committed screenshots
```

Node version: see `.nvmrc`. The Playwright tests need a browser once: `npx playwright install chromium`.

### Screenshot tests

`npm run test:visual` is the safety net for changes to the scene: refactors should leave every screenshot
unchanged. WebGL output differs between GPUs and operating systems, so the baselines in
`e2e/visual.spec.ts-snapshots/` are per platform (currently macOS, rendered on the GPU) and the suite runs locally,
not in CI. When a change is meant to alter the look, check the new images, then refresh them with
`npx playwright test e2e/visual.spec.ts --update-snapshots`.

## Structure

- `src/data/rooms.ts`: the room registry. Every room's outline, name, starting paint and camera view, the openings
  between rooms, and helpers for sizes and extents. Scene coordinates are metres with the bedroom centred on the
  origin, x east and z south; the conversion from SketchUp coordinates is at the top of the file.
- `src/data/catalog.ts`: palettes, paints, rugs, pillows, art, camera views and the living-room furniture list
- `src/data/roomDefs.ts`: the pieces in each room, their product variants and options, and their starting state.
  The hall has no pieces.
- `src/data/fabrics.ts`, `src/data/bemzFabrics.ts`: the `BemzFabric` type with search, swatch/product URL and price
  helpers, and the captured list of Bemz fabrics for the NOCKEBY cover (generated; do not edit by hand)
- `scripts/bemz-fabrics.mjs`, `scripts/bemzParse.mjs`: the capture script and its parsers. Refresh the fabric list and
  prices with `node scripts/bemz-fabrics.mjs` (2-3 minutes, 0.5 s between requests) and commit the diff
- `src/state/`: version 6 settings. Each room keeps its paint, physical groups, and pieces in `rooms[roomId]`, with accent and moulding
  where applicable. The app migrates version 1–5 settings, including saves under the old `bedroom-viz` key, and
  saves the result to `localStorage['apartment-playground']`.
- `src/scene/`: the imperative three.js scene
  - `createScene.ts`: wires the pieces together: renderer, rooms, furniture, lighting, camera and the frame loop
  - `buildApartment.ts` / `apartment.ts`: every room's walls, floor, ceiling and skirting, built from its outline and
    openings in `rooms.ts`, plus the doors and windows of rooms that are not hand-built. Parts mounted on a wall are
    hidden while the camera looks through that wall from outside
  - `bedroom/`: the bedroom's fittings and furniture, one module per part (doors, arched windows and curtains, bed,
    dresser, bedside lamps, pendant, wardrobes, rug, moulding), each owning what its settings change;
    `dimensions.ts` holds its measurements, derived from `rooms.ts` where the room data has them
  - `office/`: the office's furniture, drawn by hand like the bedroom's (METOD cabinets in the wall colour, IDÅSEN
    desk and drawer unit, ALEFJÄLL chair), and `corner.ts`, the reading corner's chosen chair, dresser and round rug
    (`READING_CHAIRS`, `DRESSERS`, `ROUND_RUGS` in `catalog.ts`); `dimensions.ts` holds sizes and positions
  - `lamps.ts`, `roomLamps.ts`: the pendant and floor lamp chosen for the living room and office, drawn from their
    catalog shape (`PENDANTS`, `FLOOR_LAMPS` in `catalog.ts`), each with its own evening light
  - `daylight.ts`, `roomLights.ts`: sun, sky and window light; an evening fill light in the other rooms, dimmed in
    the living room or office once a lamp is chosen there
  - `orbitCamera.ts`: drag, wheel and pinch controls, eased towards a pose, and click detection
  - `furniture.ts`: loads the living-room models from `public/models/`; `trimGeometry.ts` cuts the String shelving's
    two left columns to half height as it loads
  - `sofaFabric.ts`, `fabricDetail.ts`: the chosen Bemz fabric on the sofa, and the procedural weave drawn for plain
    fabrics (pattern fabrics load their swatch photo)
  - `livingMoulding.ts`: the living room's sofa-wall and TV-wall moulding, laid out like the bedroom's
    (`layout.ts`) and hidden with its wall
  - `merge.ts`: merges parts that never move apart into one mesh per material, to keep draw calls down
  - `rigidPlacement.ts`: checks a proposed translation against the mounts and room boundaries of every leaf in a
    selection. It reports furniture overlaps separately from blocked moves and does not change or save any positions.
  - `canvas.ts` / `textures.ts`: procedural canvas drawing (no three.js, so the panel's rug thumbnails can use it)
    and the three.js textures made from it
  - pure helpers for layout, palettes, picking rooms and freeing GPU resources, each with tests
- `src/components/`: React UI; `Stage` owns the canvas and bridges settings into the scene
- `e2e/`: Playwright smoke and screenshot tests

### Performance

- The scene is drawn only when something changes (a setting, the camera, the canvas size, a model loading); an idle
  page draws nothing.
- Static parts of each room are merged into one mesh per material.
- three.js and the scene load in a chunk of their own, after the panel.
- The models in `public/models/` are meshopt-compressed. To add one, compress it the same way:
  `npx @gltf-transform/cli meshopt in.glb public/models/living/out.glb --level medium`.

### three.js version

The scene was lit and tuned under three.js r128 and now runs on r187. Newer releases manage colour, measure light in
physical units and filter soft shadows differently, so `src/scene/legacyLook.ts` keeps the r128 look: colour
management off, light colours scaled by π, r128's distance falloff and its grid-filtered soft shadows, patched into
three's shaders, and point-light shadow bias applied in distance as r128 did. The result is close but not
pixel-exact: r187 filters each shadow tap bilinearly, its standard material differs slightly, and it shadows the
living-room models where r128 let sunlight leak onto them through walls. Each patch throws if it no longer finds its target (and `legacyLook.test.ts` checks them), so an
upgrade that changes those shaders fails loudly; run the screenshot tests after any three.js upgrade.

## CI/CD

- `.github/workflows/ci.yml`: lint, typecheck, unit tests, build and the browser smoke test on every pull request.
- `.github/workflows/deploy.yml`: on push to `main`, runs the same checks, then builds and deploys `dist/` to
  GitHub Pages.
