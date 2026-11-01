import { compose } from './env'

export default function globalTeardown(): void {
  compose('down', '-v', '--remove-orphans')
}
