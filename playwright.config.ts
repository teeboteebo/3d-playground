import { defineConfig } from '@playwright/test';

/* PW_PORT lets two checkouts run their browser tests at once without sharing a dev server */
const PORT = Number(process.env.PW_PORT ?? 5199);

/**
 * Browser tests against the dev server.
 *  - smoke.spec.ts runs everywhere (CI included): the app loads and draws the scene.
 *  - visual.spec.ts compares each camera view, day and evening, with committed screenshots. WebGL output differs
 *    between GPUs and operating systems, so the baselines are per platform and the suite is run locally
 *    (npm run test:visual) around changes to the scene, not in CI.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  /* the GPU occasionally renders a frame a few hundred pixels off; a real change fails both tries */
  retries: 1,
  expect: { toHaveScreenshot: { maxDiffPixels: 200, threshold: 0.05, animations: 'disabled' } },
  use: {
    baseURL: `http://localhost:${PORT}/3d-playground/`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    launchOptions: { args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/3d-playground/`,
    reuseExistingServer: !process.env.CI,
  },
});
