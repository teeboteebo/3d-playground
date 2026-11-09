# Apartment Playground

Interactive 3D model of an apartment, decoded from a SketchUp model. Pick a room and try wall colours; in the
bedroom, try rugs, pillows, art, wall moulding and wardrobe colours; in the living room, switch furniture on and
off. Day and evening lighting are shared by every room.

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
- `src/state/`: the settings type, sanitising/migration of saved settings, and the `useSettings` hook
  (persists to `localStorage['bedroom-viz']`)
- `src/scene/`: the imperative three.js scene
  - `createScene.ts`: builds the scene, applies settings and runs the orbit camera; the bedroom is built here by hand
  - `buildApartment.ts` / `apartment.ts`: the other rooms' walls, floors, windows and doors, built from their outlines
  - `furniture.ts`: loads the living-room models from `public/models/`
  - `textures.ts`: procedural canvas textures (wood, parquet, rugs, art)
  - pure helpers for layout, palettes, picking rooms and freeing GPU resources, each with tests
- `src/components/`: React UI; `Stage` owns the canvas and bridges settings into the scene
- `e2e/`: Playwright smoke and screenshot tests

three.js is pinned to r128, the version the original single-file app used. Newer releases change colour management
and light units, which would visibly change the scene.

## CI/CD

- `.github/workflows/ci.yml`: lint, typecheck, unit tests, build and the browser smoke test on every pull request.
- `.github/workflows/deploy.yml`: on push to `main`, runs the same checks, then builds and deploys `dist/` to
  GitHub Pages.
