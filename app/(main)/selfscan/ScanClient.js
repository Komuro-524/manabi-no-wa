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
    </div>
  )
}

// 右の「これまでの自己分析」に出す、いちばん新しい分析の結果。
// 「何が映っていたから、どのタグを候補にしたか」を説明する（モデル名や費用などの作業ログは出さない）
const STATUS = { official: '正式なタグ', proposed: '格上げ候補のタグ', candidate: '育ちかけのタグ', new: '新しい言葉' }
export function ScanLog() {
  const s = useScan()
  const r = s?.res?.result
  if (!r) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
      <b style={{ fontSize: 14 }}>いまの分析でわかったこと</b>
      <span className="sub">{r.frames}枚の静止画を1枚ずつ見て、{r.minFrames}枚以上に映っていたものだけを候補にしました</span>
      {r.passed.length === 0 && <span className="sub">今回は候補にできるものがありませんでした</span>}
      {r.passed.map(p => (
        <div key={p.tag} className="topic" style={{ gap: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14 }}>{p.tag}</b>
            <span className="chip" style={{ padding: '2px 8px', fontSize: 10, background: 'var(--teal-bg)', color: 'var(--teal)' }}>{r.frames}枚中{p.frameCount}枚</span>
            <span className="sub" style={{ fontSize: 10 }}>{STATUS[p.status] ?? ''}</span>
          </span>
          {p.reasons.map((t, i) => <span key={i} style={{ fontSize: 12, lineHeight: 1.6 }}>・{t}</span>)}
          {p.note && <span className="sub" style={{ fontSize: 11 }}>{p.note}</span>}
        </div>
      ))}
      {r.droppedByFrames.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="sub" style={{ fontWeight: 700 }}>候補にしなかったもの</span>
          {r.droppedByFrames.map(d => (
            <span key={d.tag} className="sub" style={{ fontSize: 12, lineHeight: 1.6 }}>
              <b>{d.tag}</b>：{d.frameCount}枚にしか映っていなかった（たまたま開いた画面かもしれないため）{d.reasons[0] ? `。${d.reasons[0]}` : ''}
            </span>
          ))}
          {r.droppedByGate.map((d, i) => (
            <span key={i} className="sub" style={{ fontSize: 12 }}><b>{d.tag}</b>：タグにできない言葉だった（{d.why}）</span>
          ))}
        </div>
      )}
      <span className="sub" style={{ fontSize: 11 }}>候補にしたタグは非公開で付いています。公開するかはプロフィールで決められます</span>
    </div>
  )
}
