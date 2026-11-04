# Bedroom Visualizer → React app (design)

## Intent

Turn the single-file `index.html` (three.js r128 bedroom visualizer, ~880 lines of
inline JS/CSS) into a maintainable React app with CI and automatic deploys,
**without changing what the user sees or how it behaves**.

Success criteria:

- `npm run dev` / `npm run build` work; the built app looks and behaves like the original
  (same scene, controls, camera views, lighting toggles, rug list, saved settings).
- Existing saved settings in `localStorage['bedroom-viz']` still load.
- CI runs lint, typecheck, tests and build on every PR and push to `main`.
- Pushes to `main` deploy to GitHub Pages (https://teeboteebo.github.io/3d-playground/).

## Decisions

| Topic | Choice | Why |
|---|---|---|
| Build | Vite + React 19 + TypeScript (strict) | User choice; standard, fast. |
| 3D | Imperative three.js in typed modules, bridged into React by one `useEffect` | Pixel-identical port with low risk; no geometry rewrite. |
| three version | Pinned `three@0.128.0` (+ `@types/three@0.128.0`) | Matches the CDN build. Newer versions change colour management and light units, which would visibly change the scene. Upgrading is a separate task. |
| State | React `useState` in `useSettings`, sanitised load + persist to the same localStorage key | One source of truth; the scene receives settings via `scene.apply(settings)`. |
| Tests | Vitest + Testing Library (jsdom) | Pure logic (settings sanitising, colour maths, bed-wall layout, pillow palettes) and UI interaction (with the scene mocked). |
| Lint | ESLint flat config + typescript-eslint + react-hooks | Standard. |
| CI/CD | `.github/workflows/ci.yml` (PR + main) and `deploy.yml` (main → Pages via `actions/deploy-pages`) | Pages source switches from legacy branch build to GitHub Actions. |

## Architecture

```
src/
  data/catalog.ts        palettes, pillows, wardrobes, art, frames, rugs, views, accent presets
  lib/color.ts           isHex, mixHex
  state/settings.ts      Settings type, DEFAULTS, sanitizeSettings(raw), load/save
  state/useSettings.ts   React hook: settings + update(patch), persists on change
  scene/textures.ts      seeded RNG + procedural canvas textures (rugs, wood, floor, art, mirror)
  scene/layout.ts        bedWallLayout(mcen, mgap, msw) – pure moulding/table geometry maths
  scene/palette.ts       pillowColours(id, accent) – accent-derived colours
  scene/createScene.ts   builds the room; returns { apply(settings), setView(view), rugThumbs, dispose() }
  components/
    App.tsx              layout grid, owns settings, wires Stage + Panel
    Stage.tsx            canvas, hint, light bar, view bar, no-WebGL fallback
    Panel.tsx            title, palette strip, all sections, note
    ChipGroup.tsx, AccentPicker.tsx, MouldingSection.tsx, RugList.tsx, Icon.tsx
  styles.css             original CSS, unchanged tokens and light/dark themes
```

Data flow: UI → `update(patch)` → new `settings` → `useEffect` calls `scene.apply(settings)`
(materials, textures, rug, lighting, moulding layout). Camera views call `scene.setView()`.
The render loop reads the latest settings for per-frame visibility (moulding toggles).

The original mutated module-level globals (`CLAY`, `PILLOWS[0]`) for the accent colour;
the port derives accent colours from `settings.accent` through pure functions instead.

Error handling: if `WebGLRenderer` throws, `createScene` throws and `Stage` shows the
original "needs WebGL" message; the panel still works.

## Out of scope

Upgrading three.js, React Three Fiber, new features, re-enabling the fixed wall/trim/floor choices.
