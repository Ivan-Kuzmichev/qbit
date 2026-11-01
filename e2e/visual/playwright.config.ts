import { defineConfig, devices } from '@playwright/test'

const PORT = 5199

/** The visual pass needs no qBittorrent: it serves the production build and mocks /api/v2/* per page. */
export default defineConfig({
  testDir: '.',
  testMatch: '*.visual.ts',
  outputDir: '../../test-results/visual/.playwright',
  workers: 1,
  reporter: 'list',
  webServer: {
    // the built bundle, not the dev server: CSS order in the bundle is part of what is measured
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    cwd: '../..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}/`,
    // keep the dev server's locale independent of the machine
    locale: 'ru-RU',
    timezoneId: 'UTC',
  },
})
