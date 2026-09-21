import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen } from '@/lib/format'

// ライブのタネの足あと（DB上は quests / quest_steps）。場づくりエージェントの判断を時系列で
const STATUS = { scouting: '育ち待ち', inviting: '話し手に相談中', scheduling: '日程を決め中', opened: 'ライブ予約済み', done: '開催済み', skipped: '見送り', abandoned: 'あきらめた' }
const KIND = { judge: '判断', invite: '相談', schedule: '日程', open: '予約', nudge: '呼び水', giveup: 'あきらめ', remind: '催促' }

export default async function SeedDetail({ searchParams }) {
  const sp = await searchParams
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const [{ data: quests }, { data: users }] = await Promise.all([
    db.from('quests').select('id, status, current_invitee, live_id, tags(name)').order('id', { ascending: false }),
    db.from('users').select('id, display_name'),
  ])
  const who = new Map((users ?? []).map(u => [u.id, u.display_name]))
  const selId = sp.id ? Number(sp.id) : (quests ?? [])[0]?.id
  const sel = (quests ?? []).find(q => q.id === selId)
  const { data: steps } = sel ? await db.from('quest_steps').select('id, kind, decision, reason, created_at').eq('quest_id', sel.id).order('id') : { data: [] }

  return (
    <>
      <Topbar me={me} title="タネの足あと" sub="場づくりエージェントが、なぜそう決めたか">
        <Link className="btn btn-s" href="/admin/progress"><Icon name="back" size={14} /> ライブのタネへ</Link>
      </Topbar>
      <div className="body" style={{ flexDirection: 'row', gap: 14, overflow: 'hidden' }}>
        <div className="card sh" style={{ width: 260, flexShrink: 0, padding: 8, overflowY: 'auto' }}>
          {(quests ?? []).map(q => (
            <Link key={q.id} href={`/admin/quests?id=${q.id}`} style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', borderRadius: 8, color: 'var(--ink)', background: q.id === selId ? 'var(--bg)' : undefined }}>
              <b style={{ fontSize: 14 }}>＃{q.tags?.name ?? '?'}</b>
              <span className="sub" style={{ fontSize: 11 }}>{STATUS[q.status] ?? q.status}</span>
            </Link>
          ))}
        </div>
        {sel && (
          <div className="card sh" style={{ flexGrow: 1, minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>＃{sel.tags?.name}</span>
              <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)' }}>{STATUS[sel.status] ?? sel.status}</span>
              {sel.current_invitee && <span className="sub">話し手: {who.get(sel.current_invitee)}さん</span>}
              {sel.live_id && <Link className="btn btn-s" href={`/live/${sel.live_id}`}>予約したライブ</Link>}
            </div>
            {(steps ?? []).length === 0 && <span className="sub">まだありません</span>}
            {(steps ?? []).map(s => (
              <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', borderLeft: '3px solid var(--line)', paddingLeft: 12 }}>
                <span className="sub" style={{ width: 100, flexShrink: 0 }}>{fmtWhen(s.created_at)}</span>
                <span className="chip" style={{ background: s.decision === 'open' ? 'var(--teal-bg)' : 'var(--amber-bg)', color: s.decision === 'open' ? 'var(--teal)' : 'var(--amber)', flexShrink: 0 }}>{KIND[s.kind] ?? s.kind}</span>
                <span style={{ fontSize: 14, lineHeight: 1.6 }}>{s.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
