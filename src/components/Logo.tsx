import { useId } from 'react'

export function Logo({ size = 36 }: { size?: number }) {
  // Id único por instancia: si una copia está oculta (display:none), su degradé no se puede referenciar.
  const gid = `ax-g-${useId().replace(/:/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B4BDB" />
          <stop offset="1" stopColor="#C255CF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gid})`} />
      <line x1="32" y1="11" x2="32" y2="18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="9.5" r="3.6" fill="#5EEAF4" />
      <rect x="10" y="27" width="5" height="11" rx="2.5" fill="#fff" />
      <rect x="49" y="27" width="5" height="11" rx="2.5" fill="#fff" />
      <rect x="14" y="17" width="36" height="31" rx="10" fill="#fff" />
      <rect x="19" y="23.5" width="26" height="13" rx="6.5" fill="#161B33" />
      <rect x="24" y="27.5" width="5" height="5" rx="2.5" fill="#5EEAF4" />
      <rect x="35" y="27.5" width="5" height="5" rx="2.5" fill="#5EEAF4" />
      <path d="M26.5 40.5q5.5 4.6 11 0" fill="none" stroke="#4A44D6" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="21" y="50" width="22" height="8" rx="4" fill="#fff" opacity=".9" />
    </svg>
  )
}
