# Apartment Playground

Interactive 3D model of an apartment, decoded from a SketchUp model. Pick a room and try wall colours; in the
bedroom, try rugs, pillows, art, wall moulding and wardrobe colours; in the living room, switch furniture on and
off and try lamps and wall moulding. Day and evening lighting are shared by every room.

Built with React, TypeScript, Vite and three.js.

Live: https://teeboteebo.github.io/3d-playground/

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
- `src/state/`: the settings, grouped by room and versioned (`version: 2`), with sanitising and migration of
  anything saved earlier, and the `useSettings` hook (persists to `localStorage['apartment-playground']`; settings
  saved under the old `bedroom-viz` key are read and migrated)
- `src/scene/`: the imperative three.js scene
  - `createScene.ts`: wires the pieces together: renderer, rooms, furniture, lighting, camera and the frame loop
  - `buildApartment.ts` / `apartment.ts`: every room's walls, floor, ceiling and skirting, built from its outline and
    openings in `rooms.ts`, plus the doors and windows of rooms that are not hand-built. Parts mounted on a wall are
    hidden while the camera looks through that wall from outside
  - `bedroom/`: the bedroom's fittings and furniture, one module per part (doors, arched windows and curtains, bed,
    dresser, bedside lamps, pendant, wardrobes, rug, moulding), each owning what its settings change;
    `dimensions.ts` holds its measurements, derived from `rooms.ts` where the room data has them
  - `office/`: the office's furniture, drawn by hand like the bedroom's (METOD cabinets in the wall colour, IDÅSEN
    desk and drawer unit, ALEFJÄLL chair); `dimensions.ts` holds its sizes and positions
  - `lamps.ts`, `roomLamps.ts`: the pendant and floor lamp chosen for the living room and office, drawn from their
    catalog shape (`PENDANTS`, `FLOOR_LAMPS` in `catalog.ts`), each with its own evening light
  - `daylight.ts`, `roomLights.ts`: sun, sky and window light; an evening fill light in the other rooms, dimmed in
    the living room or office once a lamp is chosen there
  - `orbitCamera.ts`: drag, wheel and pinch controls, eased towards a pose, and click detection
  - `furniture.ts`: loads the living-room models from `public/models/`; `trimGeometry.ts` cuts the String shelving's
    two left columns to half height as it loads
  - `livingMoulding.ts`: the living room's sofa-wall and TV-wall moulding, laid out like the bedroom's
    (`layout.ts`) and hidden with its wall
  - `merge.ts`: merges parts that never move apart into one mesh per material, to keep draw calls down
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
