import { useEffect, useState } from 'react'
import { fetchVisibleSigns, type ScannedSign } from './signScan'

/** Signs from the last dream-sign scan, or none: no scan yet, offline, or the table isn't set up. Callers fall back to tags. */
export function useScannedSigns(): ScannedSign[] {
  const [signs, setSigns] = useState<ScannedSign[]>([])
  useEffect(() => {
    let cancelled = false
    fetchVisibleSigns().then((s) => { if (!cancelled) setSigns(s) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  return signs
}
