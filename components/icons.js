// モックと同じ線画アイコン（stroke=currentColor）
const P = {
  live: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/></>,
  cards: <><rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7.5 3.5H19a2 2 0 0 1 2 2v11"/></>,
  map: <><path d="M9 4 3.5 6.2v14L9 18l6 2.2 5.5-2.2v-14L15 6.2z"/><path d="M9 4v14M15 6.2v14"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/></>,
  invite: <><path d="M6 3.5v17"/><path d="M6 5h12l-2.5 4L18 13H6"/></>,
  scan: <><path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M20 8.5V5.5A1.5 1.5 0 0 0 18.5 4h-3M4 15.5v3A1.5 1.5 0 0 0 5.5 20h3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3"/><path d="M7.5 12h9"/></>,
  admin: <><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/></>,
  arrow: <path d="M4.5 12h14M13 6.5 18.5 12 13 17.5"/>,
  tag: <><path d="M3.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5l8 8-9 9z"/><circle cx="7.8" cy="7.8" r="1.4"/></>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.3 2"/></>,
  play: <path d="M8 5.2 19 12 8 18.8z"/>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.2 4.2"/></>,
  bell: <><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0v4.5l1.8 2.8H4.7l1.8-2.8z"/><path d="M10 19.5a2 2 0 0 0 4 0"/></>,
  back: <path d="M14.5 5.5 8 12l6.5 6.5"/>,
  send: <><path d="M4 12 20 4l-6 16-3-7z"/><path d="M11 13l9-9"/></>,
  robot: <><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></>,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/></>,
}
export function Icon({ name, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      {P[name]}
    </svg>
  )
}

export function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size * 124 / 120} viewBox="0 0 120 124" fill="none" aria-hidden="true" style={{ flexShrink: 0, overflow: 'visible' }}>
      <path d="M99.1 43.7A40 40 0 1 1 78.8 16.7" stroke="#F3EFE7" strokeWidth="10.5" strokeLinecap="round"/>
      <path d="M78.8 16.7 99.1 43.7" stroke="#F3EFE7" strokeWidth="7" strokeLinecap="round"/>
      <rect x="81" y="23.2" width="16" height="14" rx="4.5" fill="#F3EFE7" transform="rotate(53.1 89 30.2)"/>
      <g transform="translate(47.6 90.0) rotate(8)"><circle r="4.2" fill="none" stroke="#F3EFE7" strokeWidth="2.2"/><path d="M0 3.4 8.6 12.4V33a3.6 3.6 0 0 1-3.6 3.6h-10A3.6 3.6 0 0 1-8.6 33V12.4z" fill="#D9533C"/><circle cy="12.6" r="2.1" fill="#2B3A52"/></g>
      <g transform="translate(33.2 81.7) rotate(-9)"><circle r="4.2" fill="none" stroke="#F3EFE7" strokeWidth="2.2"/><path d="M0 3.4 8.6 12.4V33a3.6 3.6 0 0 1-3.6 3.6h-10A3.6 3.6 0 0 1-8.6 33V12.4z" fill="#C8780C"/><circle cy="12.6" r="2.1" fill="#2B3A52"/></g>
      <g transform="translate(23.4 68.3) rotate(-23)"><circle r="4.2" fill="none" stroke="#F3EFE7" strokeWidth="2.2"/><path d="M0 3.4 8.6 12.4V33a3.6 3.6 0 0 1-3.6 3.6h-10A3.6 3.6 0 0 1-8.6 33V12.4z" fill="#0E9AA0"/><circle cy="12.6" r="2.1" fill="#2B3A52"/></g>
      <text x="60" y="53" textAnchor="middle" dominantBaseline="central" fontFamily="Zen Maru Gothic, sans-serif" fontSize="42" fontWeight="700" fill="#FFFFFF">わ</text>
    </svg>
  )
}
