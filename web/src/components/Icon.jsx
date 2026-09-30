const PATHS = {
  play: <path d="M5 3l8 5-8 5z" fill="currentColor" />,
  fit: <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" />,
  fullscreen: <path d="M3 3h4M3 3v4M13 3H9M13 3v4M3 13h4M3 13V9M13 13H9M13 13V9" />,
  link: <path d="M6.5 9.5l3-3M5 8L3.5 9.5a2.5 2.5 0 003.5 3.5L8.5 11.5M11 8l1.5-1.5A2.5 2.5 0 009 3L7.5 4.5" />,
  theme: <><circle cx="8" cy="8" r="5" /><path d="M8 3a5 5 0 010 10z" fill="currentColor" /></>,
  help: <><circle cx="8" cy="8" r="6" /><path d="M6.3 6.3a1.8 1.8 0 113 1.2c-.6.5-1.3.8-1.3 1.6M8 11.6v.1" /></>,
  ask: <path d="M8 2l1.3 3.7L13 7l-3.7 1.3L8 12 6.7 8.3 3 7l3.7-1.3z" />,
}

export function Icon ({ name }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
