export function readTheme () {
  try {
    const saved = localStorage.getItem('prl-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function saveTheme (theme) {
  try { localStorage.setItem('prl-theme', theme) } catch {}
}
