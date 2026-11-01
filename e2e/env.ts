import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const BASE_URL = 'http://localhost:18080'
export const USERNAME = 'admin'
export const PASSWORD = 'qbit-e2e-pass'
export const COMPOSE_FILE = fileURLToPath(new URL('./docker-compose.yml', import.meta.url))

export function compose(...args: string[]): string {
  return execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
