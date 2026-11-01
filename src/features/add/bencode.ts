export type BValue = number | Uint8Array | BValue[] | { [key: string]: BValue }

export class BencodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BencodeError'
  }
}

const MAX_DEPTH = 64
const COLON = 0x3a
const E = 0x65
const D = 0x64
const I = 0x69
const L = 0x6c
const MINUS = 0x2d

/** Dict keys are read as Latin-1 so that any byte sequence round-trips. */
function latin1(b: Uint8Array): string {
  let s = ''
  for (const c of b) s += String.fromCharCode(c)
  return s
}

class Reader {
  pos = 0
  /** Byte range of each value in the top-level dict, by key. */
  spans: Record<string, [number, number]> = {}
  constructor(private b: Uint8Array) {}

  private digits(stop: number, allowSign: boolean): number {
    const start = this.pos
    if (allowSign && this.b[this.pos] === MINUS) this.pos++
    const first = this.pos
    while (this.pos < this.b.length && this.b[this.pos] >= 0x30 && this.b[this.pos] <= 0x39) this.pos++
    const len = this.pos - first
    if (len === 0 || this.b[this.pos] !== stop) throw new BencodeError(`Bad number at ${start}`)
    if (len > 1 && this.b[first] === 0x30) throw new BencodeError(`Leading zero at ${start}`)
    const n = Number(latin1(this.b.subarray(start, this.pos)))
    this.pos++
    return n
  }

  private string(): Uint8Array {
    const len = this.digits(COLON, false)
    if (this.pos + len > this.b.length) throw new BencodeError('Truncated string')
    const out = this.b.subarray(this.pos, this.pos + len)
    this.pos += len
    return out
  }

  value(depth: number): BValue {
    if (depth > MAX_DEPTH) throw new BencodeError('Nesting too deep')
    if (this.pos >= this.b.length) throw new BencodeError('Unexpected end')
    const c = this.b[this.pos]
    if (c === I) {
      this.pos++
      return this.digits(E, true)
    }
    if (c === L) {
      this.pos++
      const list: BValue[] = []
      while (this.b[this.pos] !== E) list.push(this.value(depth + 1))
      this.pos++
      return list
    }
    if (c === D) {
      this.pos++
      const dict: { [key: string]: BValue } = {}
      while (this.b[this.pos] !== E) {
        if (this.pos >= this.b.length) throw new BencodeError('Truncated dict')
        const c0 = this.b[this.pos]
        if (c0 < 0x30 || c0 > 0x39) throw new BencodeError('Dict key must be a string')
        const key = latin1(this.string())
        const start = this.pos
        dict[key] = this.value(depth + 1)
        if (depth === 0) this.spans[key] = [start, this.pos]
      }
      this.pos++
      return dict
    }
    if (c >= 0x30 && c <= 0x39) return this.string()
    throw new BencodeError(`Unexpected byte at ${this.pos}`)
  }
}

export function decodeWithSpans(bytes: Uint8Array): { value: BValue; spans: Record<string, [number, number]> } {
  const r = new Reader(bytes)
  try {
    const value = r.value(0)
    return { value, spans: r.spans }
  } catch (e) {
    if (e instanceof BencodeError) throw e
    // a read past the end can surface as a TypeError on undefined; it is still truncated input
    throw new BencodeError('Malformed input')
  }
}

export function decode(bytes: Uint8Array): BValue {
  return decodeWithSpans(bytes).value
}
