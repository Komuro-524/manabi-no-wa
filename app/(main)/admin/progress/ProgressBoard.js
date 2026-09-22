'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from '@/components/Link'
import Planter from '@/components/Planter'
import FieldWorker from '@/components/FieldWorker'
import { fmtWhen } from '@/lib/format'
import { poll } from '@/lib/poll.mjs'

// 列＝プランターを真上から見た形（縁が素焼き・中は土）。タネのカードは土に挿した札。
// 進み具合ごとに植物が育つ（種 → 芽 → 葉 → つぼみ → 花）。同じ段階の中では需要（直近30日に語られた回数）が多いほど大きく描く
const COLS = [
  ['scouting', '育ち待ち', 'タネ'],
  ['inviting', '話し手に相談中', '芽'],
  ['scheduling', '日程を決め中', '葉'],
  ['opened', 'ライブ予約済み', 'つぼみ'],
  ['done', '開催済み', '花'],
]
const isRunning = run => run?.status === 'running' && Date.now() - new Date(run.started_at).getTime() < 600000

export default function ProgressBoard({ initial }) {
  const [data, setData] = useState(initial)
  const [error, setError] = useState('')
  const kick = useRef(false)   // 見回りを押した直後は短い間隔で読む
  useEffect(() => setData(initial), [initial])
  const read = useCallback(async signal => {
    const response = await fetch(`/api/admin/progress?page=${initial.page}`, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('更新できませんでした。少し待って再試行します')
    return response.json()
  }, [initial.page])
  const receive = useCallback(next => { setError(''); setData(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next) }, [])
  useEffect(() => poll({
    read, receive,
    fail: () => setError('更新できませんでした。少し待って再試行します'),
    interval: next => (kick.current || isRunning(next?.run)) ? 3000 : 15000,
    initial,
  }), [initial.page])
  // 畑番（FieldWorker）から「いま読み直して」と頼まれたとき
  const refresh = useCallback(async () => {
    kick.current = true
    try { receive(await read()) } catch {}
  }, [read, receive])

  const { quests, run, page, total, runLog } = data
  const running = isRunning(run)
  if (!running && kick.current && run?.finished_at) kick.current = false

  return (
    <div className="body" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <FieldWorker running={running} run={run ? { started_at: run.started_at, finished_at: run.finished_at } : null} steps={runLog ?? []} refresh={refresh} />
        </div>
        {total > 100 && <span className="sub" style={{ flexShrink: 0 }}>全{total}件・{page}ページ</span>}
        {page > 1 && <Link href={`/admin/progress?page=${page - 1}`} className="btn btn-s">前へ</Link>}
        {page * 100 < total && <Link href={`/admin/progress?page=${page + 1}`} className="btn btn-s">次へ</Link>}
      </div>
      {error && <div role="status" className="err">{error}（表示中のデータは前回取得分です）</div>}

      <div className="noscrollbar" style={{ flexGrow: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${COLS.length}, minmax(170px, 1fr))`, gap: 10, overflowX: 'auto' }}>
        {COLS.map(([st, name, plant], stage) => {
          const rows = quests.filter(q => q.status === st).sort((a, b) => b.demand - a.demand)
          const top = Math.max(1, ...rows.map(q => q.demand))
          return (
            <div key={st} className="planter">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}><Planter stage={stage} size={30} title={plant} /><b className="planter-name">{name}</b><span className="kpi planter-name" style={{ fontSize: 16 }}>{rows.length}</span></div>
              <div className="noscrollbar planter-soil" style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0, flexGrow: 1 }}>
                {rows.map(q => (
                  <Link key={q.id} href={`/admin/quests?id=${q.id}`} className="card hoverable" title="判断の足あとを見る"
                    style={{ padding: 10, color: 'var(--ink)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <Planter stage={stage} scale={0.8 + 0.4 * (q.demand / top)} title={`${plant}（30日に${q.demand}回 語られた）`} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flexGrow: 1 }}>
                      <b style={{ overflowWrap: 'anywhere' }}>＃{q.tag}</b>
                      {q.invitee && <span className="sub">{q.invitee}さん</span>}
                      <span className="sub" style={{ fontSize: 11 }}>語られた {q.demand}回{q.lastAt ? ` ・ ${fmtWhen(q.lastAt)}` : ''}</span>
                    </span>
                    <span className="sub" aria-hidden="true" style={{ fontSize: 16 }}>›</span>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
