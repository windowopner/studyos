'use client'

import { useState } from 'react'

// Profile photo, or the first letter of the name when there's no photo or it fails to load
// (old Google photo links expire).
export default function Avatar({ src, name, className = '' }: { src?: string | null; name?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`object-cover ${className}`} />
  }
  return (
    <span className={`flex items-center justify-center bg-[var(--surface-soft)] font-medium text-[var(--text)] ${className}`}>
      {name?.trim()?.[0]?.toUpperCase() || '?'}
    </span>
  )
}
