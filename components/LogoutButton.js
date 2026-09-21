'use client'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { Icon } from './icons'

export default function LogoutButton() {
  const router = useRouter()
  return (
    <button aria-label="ログアウト" title="ログアウト"
      onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace('/login'); router.refresh() }}
      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ai-sub)', cursor: 'pointer', padding: 4 }}>
      <Icon name="logout" size={16} />
    </button>
  )
}
