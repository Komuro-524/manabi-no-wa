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
      <Topbar me={me} title="エージェント運用" sub="3体のエージェントの実行記録（agent_runs）。モデルはコードに書かず、OrcaRouter のルーターに選ばせている" />
      <div className="body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {AGENTS.map(a => {
            const rs = by(a.id)
            const ok = rs.filter(r => r.status === 'succeeded').length
            const cost = rs.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
            return (
              <div key={a.id} className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ttl">{a.name}</div>
                <span className="sub">{a.can}</span>
                <span className="mono">{a.router}</span>
                <span className="sub">専用のキー（{a.key}）。3体で鍵と予算を分けている</span>
                <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                  <Mini n={rs.length} l="実行" /><Mini n={rs.length ? `${Math.round(ok / rs.length * 100)}%` : '—'} l="成功率" /><Mini n={`$${cost.toFixed(4)}`} l="費用の合計" />
                </div>
              </div>
            )
          })}
        </div>
        <div className="note">費用は OrcaRouter が返した額（インライン）。確定額との突き合わせは scripts/reconcile-costs.mjs で行い、差は $0 だった（docs/evidence/20260921-055030-cost-reconcile.md）</div>
        <div className="card sh" style={{ padding: 16 }}>
          <div className="ttl" style={{ paddingBottom: 10 }}>実行記録</div>
          <table>
            <thead><tr><th>#</th><th>エージェント</th><th>きっかけ</th><th>対象</th><th>結果</th><th>費用</th><th>呼び出し</th><th>いつ</th><th>メモ</th></tr></thead>
            <tbody>
              {(runs ?? []).slice(0, 60).map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td>{AGENTS.find(a => a.id === r.agent)?.name}</td>
                  <td className="sub">{r.trigger}</td>
                  <td className="mono">{r.ref_id?.startsWith('live:') ? r.ref_id : r.agent === 'C' ? '（本人）' : (r.ref_id ?? '')}</td>
                  <td>{r.status === 'succeeded' ? '✅' : r.status === 'failed' ? '🛑' : '⏳'}</td>
                  <td className="mono">{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(6)}` : '—'}</td>
                  <td className="mono">{r.request_ids?.length ?? 0}回</td>
                  <td className="sub">{fmtWhen(r.started_at)}</td>
                  <td className="sub" style={{ maxWidth: 280 }}>{r.error ?? r.note ?? ''}</td>
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
