import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import AdminRunButton from '@/components/AdminRunButton'
import { fmtWhen } from '@/lib/format'

const STATUS = {
  scouting: '様子見', inviting: '打診中', scheduling: '日程調整中', opened: 'ライブ予約済み',
  done: '終わった', skipped: '見送り', abandoned: '諦めた',
}
const ORDER = ['inviting', 'scheduling', 'opened', 'scouting', 'done', 'skipped', 'abandoned']

// 企ての一覧。quests / quest_steps はブラウザから読めない設計 → 管理者と確かめてから service_role で読む
export default async function AdminQuests({ searchParams }) {
  const sp = await searchParams
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const [{ data: quests }, { data: users }] = await Promise.all([
    db.from('quests').select('id, tag_id, status, current_invitee, tried_count, live_id, next_action_at, reevaluate_at, created_at, tags(name)').order('id', { ascending: false }),
    db.from('users').select('id, display_name'),
  ])
  const who = new Map((users ?? []).map(u => [u.id, u.display_name]))
  const selId = sp.id ? Number(sp.id) : (quests ?? [])[0]?.id
  const sel = (quests ?? []).find(q => q.id === selId)
  const { data: steps } = sel
    ? await db.from('quest_steps').select('id, kind, decision, reason, model, cost_usd, created_at').eq('quest_id', sel.id).order('id')
    : { data: [] }
  const sorted = [...(quests ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.id - a.id)

  return (
    <>
      <Topbar me={me} title="企ての一覧" sub="場づくりエージェントが「この話題で場を立てるか」を考えた足あと" />
      <div className="body">
        <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="ttl">場づくりエージェントを1周動かす</div>
          <span className="sub">本番は1日1回自動で起動する設計（Vercel Cron。今回は未設定）。ここでは手で1周だけ動かせます。停止条件と費用の上限はコードで効きます</span>
          <AdminRunButton url="/api/admin/organizer" label="1周動かす" />
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div className="card sh" style={{ padding: 12, flexGrow: 1, minWidth: 0 }}>
            <table>
              <thead><tr><th>#</th><th>タグ</th><th>状態</th><th>打診先</th><th>次に動く日</th></tr></thead>
              <tbody>
                {sorted.map(q => (
                  <tr key={q.id} style={{ background: q.id === selId ? '#F6F3EE' : undefined }}>
                    <td className="mono"><Link href={`/admin/quests?id=${q.id}`}>#{q.id}</Link></td>
                    <td><Link href={`/admin/quests?id=${q.id}`} style={{ color: 'var(--ink)', fontWeight: 700 }}>{q.tags?.name ?? '?'}</Link></td>
                    <td>{STATUS[q.status] ?? q.status}</td>
                    <td>{q.current_invitee ? who.get(q.current_invitee) : '—'}{q.tried_count > 0 && <span className="sub">（{q.tried_count}人目）</span>}</td>
                    <td className="sub">{fmtWhen(q.next_action_at ?? q.reevaluate_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sel && (
            <div className="card sh" style={{ width: 440, flexShrink: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="ttl">#{sel.id}「{sel.tags?.name}」の判断の足あと</div>
              {sel.live_id && <Link className="btn btn-s" style={{ alignSelf: 'flex-start' }} href={`/live/${sel.live_id}`}>予約したライブを見る</Link>}
              {(steps ?? []).length === 0 && <span className="sub">まだありません</span>}
              {(steps ?? []).map(s => (
                <div key={s.id} style={{ borderLeft: '3px solid var(--line)', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)' }}>{s.kind}</span>
                    <span className="chip" style={{ background: s.decision === 'open' ? 'var(--teal-bg)' : 'var(--amber-bg)', color: s.decision === 'open' ? 'var(--teal)' : 'var(--amber)' }}>{s.decision}</span>
                    <span className="sub">{fmtWhen(s.created_at)}</span>
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.6 }}>{s.reason}</span>
                  {(s.model || s.cost_usd) && <span className="mono sub">{s.model ?? ''} {s.cost_usd != null ? `$${Number(s.cost_usd).toFixed(6)}` : ''}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
