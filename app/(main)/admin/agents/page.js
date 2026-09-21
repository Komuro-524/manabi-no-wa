import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import { fmtWhen } from '@/lib/format'

const AGENTS = [
  { id: 'A', name: 'タグ付けエージェント', router: 'orcarouter/manabi-recorder', key: 'ORCA_KEY_RECORDER', can: 'ライブの文字起こしとチャットから知見カードとタグの候補を作る。通知はできない' },
  { id: 'B', name: '場づくりエージェント', router: 'orcarouter/manabi-organizer', key: 'ORCA_KEY_ORGANIZER', can: '場を立てるか判断し、打診・日程・予約・最初の一言。人に話しかけられるのはこの子だけ' },
  { id: 'C', name: '自己分析エージェント', router: 'orcarouter/manabi-mirror', key: 'ORCA_KEY_MIRROR', can: '本人が選んだ画面の静止画からタグ候補を出す。画像は保存しない。タグは非公開で付く' },
]

// エージェント運用。agent_runs の実データだけを出す（モックのモデル名は写さない）
export default async function AdminAgents() {
  const me = await requireAdmin()
  const { data: runs } = await supabaseAdmin().from('agent_runs')
    .select('id, agent, trigger, status, ref_id, model, cost_usd, error, note, request_ids, started_at, finished_at')
    .order('id', { ascending: false }).limit(300)
  const by = id => (runs ?? []).filter(r => r.agent === id)

  return (
    <>
      <Topbar me={me} title="エージェント" sub="3体それぞれに別の鍵と予算を持たせています" />
      <div className="body" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {AGENTS.map(a => {
            const rs = by(a.id)
            const ok = rs.filter(r => r.status === 'succeeded').length
            const cost = rs.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
            return (
              <div key={a.id} className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ttl">{a.name}</div>
                <span className="sub">{a.can}</span>
                <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                  <Mini n={rs.length} l="実行" /><Mini n={rs.length ? `${Math.round(ok / rs.length * 100)}%` : '—'} l="成功率" /><Mini n={`$${cost.toFixed(4)}`} l="費用の合計" />
                </div>
              </div>
            )
          })}
        </div>
        <div className="card sh" style={{ padding: 16, flexGrow: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="ttl" style={{ paddingBottom: 8 }}>最近の実行</div>
          <table>
            <thead><tr><th>エージェント</th><th>結果</th><th>費用</th><th>いつ</th></tr></thead>
            <tbody>
              {(runs ?? []).slice(0, 20).map(r => (
                <tr key={r.id}>
                  <td>{AGENTS.find(a => a.id === r.agent)?.name}</td>
                  <td title={r.error ?? r.note ?? ''}>{r.status === 'succeeded' ? '✅ 成功' : r.status === 'failed' ? '🛑 失敗' : '⏳ 実行中'}</td>
                  <td className="mono">{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(6)}` : '—'}</td>
                  <td className="sub">{fmtWhen(r.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
function Mini({ n, l }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}><span className="kpi" style={{ fontSize: 20 }}>{n}</span><span className="sub">{l}</span></div>
}
