'use client'
import { useState } from 'react'
import Link from '@/components/Link'
import Planter from '@/components/Planter'
import { fmtWhen } from '@/lib/format'

// 左＝プランター（素焼きの縁・中は土）に挿したタネの札。右＝選んだタネの足あと。
// 選ぶのはブラウザの中だけ（サーバーに行かない）。URL だけ書き換えて、再読み込みしても同じタネが開く
const STATUS = { scouting: '育ち待ち', inviting: '話し手に相談中', scheduling: '日程を決め中', opened: 'ライブ予約済み', done: '開催済み', skipped: '見送り', abandoned: 'あきらめた' }
const STAGE = { scouting: 0, inviting: 1, scheduling: 2, opened: 3, done: 4 }
const KIND = { judge: '判断', invite: '相談', schedule: '日程', open: '予約', nudge: '呼び水', giveup: 'あきらめ', remind: '催促' }
const DEC = { open: ['var(--teal-bg)', 'var(--teal)'], skip: ['var(--sand)', 'var(--sub)'], wait: ['var(--amber-bg)', 'var(--amber)'] }

export default function SeedTrail({ quests, steps, initialId }) {
  const [selId, setSelId] = useState(quests.some(q => q.id === initialId) ? initialId : quests[0]?.id)
  const sel = quests.find(q => q.id === selId)
  const trail = sel ? steps[sel.id] ?? [] : []
  function pick(id) {
    setSelId(id)
    try { window.history.replaceState(null, '', `/admin/quests?id=${id}`) } catch {}
  }

  return (
    <div className="body" style={{ flexDirection: 'row', gap: 14, overflow: 'hidden' }}>
      <div className="planter" style={{ width: 290, flexShrink: 0 }}>
        <div style={{ padding: '0 4px' }}><b className="planter-name">タネ {quests.length}</b></div>
        <div className="noscrollbar planter-soil" style={{ display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', minHeight: 0, flexGrow: 1 }}>
          {quests.map(q => {
            const on = q.id === selId
            const faded = !(q.status in STAGE)
            return (
              <button key={q.id} type="button" onClick={() => pick(q.id)} aria-pressed={on} className="card hoverable"
                style={{ padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center', textAlign: 'left', cursor: 'pointer', flexShrink: 0,
                  outline: on ? '3px solid #E0B84A' : 'none', outlineOffset: -1, opacity: faded ? 0.7 : 1, font: 'inherit', color: 'var(--ink)' }}>
                {faded ? <span style={{ width: 32, textAlign: 'center', fontSize: 18 }} aria-hidden="true">🍂</span> : <Planter stage={STAGE[q.status]} size={32} />}
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <b style={{ fontSize: 14, overflowWrap: 'anywhere' }}>＃{q.tag}</b>
                  <span className="sub" style={{ fontSize: 11 }}>{STATUS[q.status] ?? q.status}{q.invitee ? ` ・ ${q.invitee}さん` : ''}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {sel && (
        <div className="card sh" style={{ flexGrow: 1, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {sel.status in STAGE && <Planter stage={STAGE[sel.status]} size={52} />}
            <span className="wa" style={{ fontSize: 26, fontWeight: 700 }}>＃{sel.tag}</span>
            <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)' }}>{STATUS[sel.status] ?? sel.status}</span>
            {sel.invitee && <span className="sub">話し手: {sel.invitee}さん</span>}
            {sel.liveId && <Link className="btn btn-s" href={`/live/${sel.liveId}`}>予約したライブ</Link>}
          </div>
          {trail.length === 0 && <span className="sub">まだ足あとはありません</span>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '3px dotted #8A5A2B', marginLeft: 10, paddingLeft: 18 }}>
            {[...trail].reverse().map(s => {
              const [bg, fg] = DEC[s.decision] ?? ['var(--blue-bg)', 'var(--blue)']
              return (
                <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', position: 'relative' }}>
                  <span aria-hidden="true" style={{ position: 'absolute', left: -26, top: 3, width: 13, height: 13, borderRadius: 999, background: '#8A5A2B', border: '2px solid #FFFDF6' }} />
                  <span className="sub" style={{ width: 100, flexShrink: 0 }}>{fmtWhen(s.at)}</span>
                  <span className="chip" style={{ background: bg, color: fg, flexShrink: 0 }}>{KIND[s.kind] ?? s.kind}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.7 }}>{s.reason}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
