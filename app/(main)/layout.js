import { redirect } from 'next/navigation'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export const dynamic = 'force-dynamic'

export default async function MainLayout({ children }) {
  const me = await currentUser()
  if (!me) redirect('/login')
  const db = await supabaseServer()
  const [{ count: liveCount }, { count: inviteCount }] = await Promise.all([
    db.from('lives').select('id', { count: 'exact', head: true }).eq('status', 'live'),
    db.from('invitations').select('id', { count: 'exact', head: true }).eq('status', 'sent'),   // RLS: 自分宛だけ
  ])
  return (
    <div className="shell">
      <Sidebar me={me} liveCount={liveCount ?? 0} inviteCount={inviteCount ?? 0} />
      <div className="main">{children}</div>
    </div>
  )
}
