function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  document.body.appendChild(area)
  area.focus()
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
    previous?.focus()
  }
}

/**
 * Copies text to the clipboard. `navigator.clipboard` is undefined on plain HTTP outside localhost,
 * which is how a NAS is usually opened, so fall back to a hidden textarea and `execCommand`.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // permission denied or document not focused: try the legacy path
    }
  }
  return legacyCopy(text)
}
