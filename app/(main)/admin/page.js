import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import { fmtWhen } from '@/lib/format'

const AGENT = { A: 'タグ付けエージェント', B: '場づくりエージェント', C: '自己分析エージェント' }
const TAG_STATUS = [['official', '正式'], ['proposed', '格上げ候補'], ['candidate', '候補'], ['rejected', '弾いた語'], ['banned', '禁止']]

// ダッシュボード。数字は DB から数えられるものだけ出す（モックの数字は写さない）
export default async function AdminHome() {
  const me = await requireAdmin()
  const db = supabaseAdmin()   // ★ 管理者と確かめた後。agent_runs などはブラウザから読めない設計
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const [users, lives, cards, tags, runs, recent, review, sent] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('lives').select('status'),
    db.from('knowledge_cards').select('id', { count: 'exact', head: true }),
    db.from('tags').select('status'),
    db.from('agent_runs').select('agent, cost_usd').gte('started_at', monthStart.toISOString()),
    db.from('agent_runs').select('id, agent, trigger, status, ref_id, model, cost_usd, error, note, started_at').order('id', { ascending: false }).limit(10),
    db.from('lives').select('id', { count: 'exact', head: true }).eq('ingest_status', 'needs_review'),
    db.from('invitations').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
  ])
  const lv = (s) => (lives.data ?? []).filter(l => l.status === s).length
  const tg = (s) => (tags.data ?? []).filter(t => t.status === s).length
  const costBy = { A: 0, B: 0, C: 0 }
  for (const r of runs.data ?? []) costBy[r.agent] = (costBy[r.agent] ?? 0) + Number(r.cost_usd ?? 0)
  const costTotal = Object.values(costBy).reduce((a, b) => a + b, 0)

  // DESIGN §4: 人が判断する4つの場所
  const gates = [
    { label: '格上げ候補のタグを承認する', n: tg('proposed'), href: '/admin/tags?tab=proposed' },
    { label: '止まったライブを確かめる（needs_review）', n: review.count ?? 0, href: '/livehub' },
    { label: '打診に返事する（社員本人）', n: sent.count ?? 0, href: '/invite' },
    { label: '自己分析のタグを採用する（社員本人）', n: null, href: '/profile' },
  ]

  return (
    <>
      <Topbar me={me} title="ダッシュボード" sub="数字はすべてデータベースから数えたもの" />
      <div className="body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <Kpi n={users.count ?? 0} label="社員" />
          <Kpi n={lv('live')} label="配信中のライブ" />
          <Kpi n={lv('scheduled')} label="予定のライブ" />
          <Kpi n={lv('ended')} label="終わったライブ" />
          <Kpi n={cards.count ?? 0} label="知見カード" />
          <Kpi n={`$${costTotal.toFixed(4)}`} label="今月のAI費用" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ttl">人が判断する場所</div>
            {gates.map(g => (
              <Link key={g.label} href={g.href} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <span style={{ flexGrow: 1, fontSize: 14 }}>{g.label}</span>
                {g.n !== null && <span className="kpi" style={{ fontSize: 20, color: g.n > 0 ? 'var(--shu)' : 'var(--sub)' }}>{g.n}</span>}
              </Link>
            ))}
            <span className="sub">AIは提案まで。正式にする・引き受ける・公開するは人が決める</span>
          </div>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ttl">タグの内訳</div>
            {TAG_STATUS.map(([s, name]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 90, fontSize: 13 }}>{name}</span>
                <div style={{ flexGrow: 1, height: 8, borderRadius: 999, background: 'var(--bar)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, tg(s) / Math.max(1, (tags.data ?? []).length) * 100)}%`, height: '100%', background: 'var(--ai)' }} />
                </div>
                <span className="num" style={{ width: 30, textAlign: 'right' }}>{tg(s)}</span>
              </div>
            ))}
            <div className="ttl" style={{ paddingTop: 8 }}>今月のAI費用（エージェント別）</div>
            {Object.entries(costBy).map(([a, c]) => <div key={a} style={{ display: 'flex', fontSize: 13 }}><span style={{ flexGrow: 1 }}>{AGENT[a]}</span><span className="mono">${c.toFixed(6)}</span></div>)}
          </div>
        </div>

        <div className="card sh" style={{ padding: 16 }}>
          <div className="ttl" style={{ paddingBottom: 10 }}>エージェントの実行記録（直近10件）</div>
          <table>
            <thead><tr><th>#</th><th>エージェント</th><th>対象</th><th>結果</th><th>費用</th><th>いつ</th><th>メモ</th></tr></thead>
            <tbody>
              {(recent.data ?? []).map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td><td>{AGENT[r.agent]}</td><td className="mono">{r.ref_id ?? r.trigger}</td>
                  <td>{r.status === 'succeeded' ? '✅ 成功' : r.status === 'failed' ? '🛑 失敗' : '⏳ 実行中'}</td>
                  <td className="mono">{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(6)}` : '—'}</td>
                  <td className="sub">{fmtWhen(r.started_at)}</td>
                  <td className="sub" style={{ maxWidth: 260 }}>{r.error ?? r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Kpi({ n, label }) {
  return (
    <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="sub">{label}</span>
      <span className="kpi" style={{ fontSize: 30 }}>{n}</span>
    </div>
  )
}
