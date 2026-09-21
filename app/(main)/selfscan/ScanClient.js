'use client'
import { useState } from 'react'
import { Icon } from '@/components/icons'
import { useScan } from '@/components/ScanProvider'

const DURATIONS = [[1, '1分（試す）'], [5, '5分'], [15, '15分'], [30, '30分'], [60, '1時間']]
const INTERVALS = [[10, '10秒ごと'], [30, '30秒ごと'], [60, '1分ごと'], [180, '3分ごと']]

// 設定して始めるところだけ。撮影と分析はアプリの外枠（ScanProvider）が持つので、画面を移っても続く
export default function ScanClient() {
  const s = useScan()
  const [minutes, setMinutes] = useState(5)
  const [every, setEvery] = useState(30)
  const busy = s.phase === 'running' || s.phase === 'sending'
  return (
    <div className="card sh" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="ttl">① 終わる時間と撮る間隔を決める</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DURATIONS.map(([v, l]) => <button key={v} disabled={busy} className={'tab' + (minutes === v ? ' tabon' : '')} onClick={() => setMinutes(v)}>{l}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {INTERVALS.map(([v, l]) => <button key={v} disabled={busy} className={'tab' + (every === v ? ' tabon' : '')} onClick={() => setEvery(v)}>{l}</button>)}
      </div>
      <span className="sub">最大{s.MAX_FRAMES}枚まで。およそ {Math.min(s.MAX_FRAMES, Math.floor(minutes * 60 / every) + 1)}枚 撮ります。時間になったら通知でお知らせします</span>
      <div className="ttl">② 映す画面を選んで始める</div>
      <span className="sub">ボタンを押すとブラウザが「どの画面を共有するか」を聞きます。ウィンドウ1つだけを選ぶのがおすすめです。始めたら、ほかの画面に移って作業して大丈夫です</span>
      <button className="btn btn-p" disabled={busy} onClick={() => s.start(minutes, every)} style={{ alignSelf: 'flex-start' }}><Icon name="scan" /> {busy ? '自己分析の途中です' : '画面を選んで始める'}</button>
      {s.phase === 'idle' && s.err && <div className="err">{s.err}</div>}
      {s.res?.log && <details><summary className="sub" style={{ cursor: 'pointer' }}>エージェントの作業ログを見る</summary>
        <pre className="mono" style={{ background: 'var(--ai)', color: '#EDE4D0', padding: 12, borderRadius: 10, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{s.res.log}</pre></details>}
    </div>
  )
}
