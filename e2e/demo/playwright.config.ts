import { defineConfig, devices } from '@playwright/test'

const PORT = 5198

/** The public demo: its own build, no qBittorrent, served under a subpath like GitHub Pages. */
export default defineConfig({
  testDir: '.',
  testMatch: '*.demo.ts',
  outputDir: '../../test-results/demo',
  reporter: 'list',
  webServer: {
    command: `npx vite build --outDir dist-demo --base=./ && node e2e/demo/serve.mjs ${PORT}`,
    cwd: '../..',
    env: { VITE_DEMO: '1' },
    url: `http://localhost:${PORT}/qbit/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: { baseURL: `http://localhost:${PORT}/qbit/` },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['iPhone 14'] } },
  ],
})
