import Link from '@/components/Link'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'

// ダッシュボード。「いま人が判断すること」と、最小限の数字だけ（詳しくは各画面へ）
export default async function AdminHome() {
  const me = await requireAdmin()
  const db = supabaseAdmin()   // ★ 管理者と確かめた後
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const [users, scheduled, cards, runs, proposed, review, failed] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('lives').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    db.from('knowledge_cards').select('id', { count: 'exact', head: true }),
    db.from('agent_runs').select('cost_usd').gte('started_at', monthStart.toISOString()),
    db.from('tags').select('id', { count: 'exact', head: true }).eq('status', 'proposed'),
    db.from('lives').select('id', { count: 'exact', head: true }).eq('ingest_status', 'needs_review'),
    db.from('agent_runs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('started_at', monthStart.toISOString()),
  ])
  const cost = (runs.data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
  const todo = [
    { n: proposed.count ?? 0, label: '格上げ候補のタグを承認する', href: '/admin/tags?tab=proposed' },
    { n: review.count ?? 0, label: '止まったライブを確かめる', href: '/admin/security' },
    { n: failed.count ?? 0, label: '失敗したエージェントの実行を見る', href: '/admin/security' },
  ]
  return (
    <>
      <Topbar me={me} title="ダッシュボード" />
      <div className="body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Kpi n={users.count ?? 0} label="社員" />
          <Kpi n={scheduled.count ?? 0} label="予定のライブ" />
          <Kpi n={cards.count ?? 0} label="知見カード" />
          <Kpi n={`$${cost.toFixed(3)}`} label="今月のAI費用" />
        </div>
        <div className="card sh" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="ttl" style={{ paddingBottom: 6 }}>あなたが判断すること</div>
          {todo.map(t => (
            <Link key={t.label} href={t.href} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)', padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}>
              <span className="kpi" style={{ fontSize: 24, width: 40, textAlign: 'right', color: t.n > 0 ? 'var(--shu)' : 'var(--sub)' }}>{t.n}</span>
              <span style={{ flexGrow: 1, fontSize: 15 }}>{t.label}</span>
              <span className="sub">→</span>
            </Link>
          ))}
          <span className="sub" style={{ paddingTop: 8 }}>AIは提案まで。正式にする・引き受ける・公開するは人が決めます</span>
        </div>
      </div>
    </>
  )
}
function Kpi({ n, label }) {
  return (
    <div className="card sh" style={{ padding: 16 }}>
      <div className="sub">{label}</div>
      <div className="kpi" style={{ fontSize: 30 }}>{n}</div>
    </div>
  )
}
