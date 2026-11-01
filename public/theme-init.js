// Sets the theme before first paint, so a light theme doesn't flash dark. Mirrors applyTheme in src/store/ui.ts.
(function () {
  var choice = 'dark'
  try {
    choice = localStorage.getItem('qbit.theme') || 'dark'
  } catch {
    // storage unavailable: the default stands
  }
  var light =
    choice === 'light' ||
    (choice === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
  document.documentElement.dataset.theme = light ? 'light' : 'dark'
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', light ? '#F4F4F5' : '#09090B')
})()
