'use client'

import { useEffect, useState } from 'react'
import { fetchGoogleStatus } from '@/lib/google'

// Whether Google Classroom/Docs is connected in this browser. Classroom features stay hidden until it is.
export function useGoogleConnected() {
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    fetchGoogleStatus().then(setConnected)
  }, [])
  return connected
}
