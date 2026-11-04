# Bedroom Visualizer

Interactive 3D bedroom visualizer: try rugs, pillows, art, wall moulding, wardrobe colours and lighting.
Built with React, TypeScript, Vite and three.js.

Live: https://teeboteebo.github.io/3d-playground/

## Develop

```bash
npm ci
npm run dev        # http://localhost:5173/3d-playground/
npm test           # Vitest unit + component tests
npm run lint
npm run typecheck
npm run build      # outputs dist/
```

Node version: see `.nvmrc`.

## Structure

- `src/data/catalog.ts`: palettes, rugs, pillows, art, camera views
- `src/state/`: settings type, sanitising/migration of saved settings, `useSettings` hook (persists to `localStorage['bedroom-viz']`)
- `src/scene/`: imperative three.js scene (`createScene.ts`), procedural textures, pure layout and palette helpers
- `src/components/`: React UI; `Stage` owns the canvas and bridges settings into the scene

three.js is pinned to r128, the version the original single-file app used. Newer releases change colour management and light units, which would visibly change the scene.

## CI/CD

- `.github/workflows/ci.yml`: lint, typecheck, test and build on every pull request and push to `main`.
- `.github/workflows/deploy.yml`: on push to `main`, builds and deploys `dist/` to GitHub Pages.
