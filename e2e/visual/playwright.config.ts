import { defineConfig, devices } from '@playwright/test'

const PORT = 5199

/** The visual pass needs no qBittorrent: it runs the dev server and mocks /api/v2/* per page. */
export default defineConfig({
  testDir: '.',
  testMatch: '*.visual.ts',
  outputDir: '../../test-results/visual/.playwright',
  workers: 1,
  reporter: 'list',
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: '../..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}/`,
    // keep the dev server's locale independent of the machine
    locale: 'ru-RU',
    timezoneId: 'UTC',
  },
})
