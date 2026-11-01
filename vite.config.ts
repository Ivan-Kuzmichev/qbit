import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.QBIT_URL || 'http://localhost:8080'

  return {
    base: './',
    publicDir: 'static',
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version),
    },
    build: {
      outDir: 'qbit/public',
      emptyOutDir: true,
      assetsInlineLimit: 0,
    },
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Origin', target)
              proxyReq.setHeader('Referer', target + '/')
            })
          },
        },
      },
    },
    test: {
      environment: 'node',
    },
  }
})
