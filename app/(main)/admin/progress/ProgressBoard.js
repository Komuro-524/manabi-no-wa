'use client'
import { useEffect, useState } from 'react'
import Link from '@/components/Link'
import AdminRunButton from '@/components/AdminRunButton'
import { fmtWhen } from '@/lib/format'
import { poll } from '@/lib/poll.mjs'
const COLS = [['scouting','育ち待ち'],['inviting','話し手に相談中'],['scheduling','日程を決め中'],['opened','ライブ予約済み'],['done','開催済み']]
export default function ProgressBoard({ initial }) {
  const [data,setData] = useState(initial)
  const [error,setError] = useState('')
  useEffect(()=>setData(initial),[initial])
  useEffect(()=>poll({
    read: async signal => {
      const response = await fetch(`/api/admin/progress?page=${initial.page}`, {signal,cache:'no-store'})
      if(!response.ok) throw new Error('更新できませんでした。少し待って再試行します')
      return response.json()
    },
    receive: next => {setError('');setData(prev=>JSON.stringify(prev)===JSON.stringify(next)?prev:next)},
    fail: () => setError('更新できませんでした。少し待って再試行します'),
    interval: next => next?.run?.status==='running' && Date.now()-new Date(next.run.started_at).getTime()<600000 ? 3000 : 15000,
    initial,
  }),[initial.page])
  const {quests,run,page,total}=data
  const running=run?.status==='running' && Date.now()-new Date(run.started_at).getTime()<600000
  return <div className="body" style={{overflow:'hidden'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
      <span className="chip">{running?'場づくりエージェントが動いています':`待機中${run?`（前回 ${fmtWhen(run.started_at)}）`:''}`}</span>
      {!running && <AdminRunButton url="/api/admin/organizer" label="いま1周動かす" small />}
      <span className="sub">全{total}件・{page}ページ</span>
      {page>1 && <Link href={`/admin/progress?page=${page-1}`} className="btn btn-s">前へ</Link>}
      {page*100<total && <Link href={`/admin/progress?page=${page+1}`} className="btn btn-s">次へ</Link>}
    </div>
    {error && <div role="status" className="err">{error}（表示中のデータは前回取得分です）</div>}
    <div style={{flexGrow:1,minHeight:0,display:'grid',gridTemplateColumns:'repeat(5,minmax(170px,1fr))',gap:10,overflowX:'auto'}}>
      {COLS.map(([status,name])=>{
        const rows=quests.filter(q=>q.status===status)
        return <div key={status} style={{background:'var(--bar)',borderRadius:12,padding:10,display:'flex',flexDirection:'column',gap:8,minHeight:0}}>
          <b>{name} <span className="sub">{rows.length}</span></b>
          <div style={{display:'flex',flexDirection:'column',gap:8,overflowY:'auto',minHeight:0}}>
            {rows.map(q=><Link key={q.id} href={`/admin/quests?id=${q.id}`} className="card" style={{padding:10,color:'var(--ink)',display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
              <b>＃{q.tag}</b>{q.invitee && <span className="sub">{q.invitee}さん</span>}
              {q.lastAt && <span className="sub" style={{fontSize:11}}>{fmtWhen(q.lastAt)}</span>}
            </Link>)}
          </div>
        </div>
      })}
    </div>
  </div>
}
