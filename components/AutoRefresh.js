'use client'
import { useEffect, useRef, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Only live views use route refresh. Schedule after completion; never stack transitions.
export default function AutoRefresh({ active, every = 4000 }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)
  useEffect(() => {
    if (pending) return
    busy.current = false
    if (!active) return
    let timer
    const refresh = () => {
      if (busy.current || document.visibilityState !== 'visible') return
      // An outgoing page can still be mounted during navigation.
      if (window.location.pathname !== pathname) return
      busy.current = true
      startTransition(() => router.refresh())
    }
    timer = setTimeout(refresh, Math.max(1000, every))
    const onVisibility = () => {
      clearTimeout(timer)
      if (document.visibilityState === 'visible') timer = setTimeout(refresh, Math.max(1000, every))
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [active, every, pending, pathname, router])
  return null
}
