'use client'
import NextLink, { useLinkStatus } from 'next/link'
import { createPortal } from 'react-dom'

// Preserve soft navigation and ScanProvider state. No speculative DB requests.
// Show pending state directly rather than suspending the shared route tree.
function Pending() {
  const { pending } = useLinkStatus()
  if (!pending || typeof document === 'undefined') return null
  return createPortal(<div role="status" aria-live="polite" className="card loader-delay"
    style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, padding: '12px 20px', pointerEvents: 'none' }}>
    読み込み中…
  </div>, document.body)
}
export default function Link({ children, ...props }) {
  return <NextLink {...props} prefetch={false}>{children}<Pending /></NextLink>
}
