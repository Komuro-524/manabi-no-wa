'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/icons'

const DURATIONS = [[1, '1分（試す）'], [5, '5分'], [15, '15分'], [30, '30分'], [60, '1時間']]
const INTERVALS = [[10, '10秒ごと'], [30, '30秒ごと'], [60, '1分ごと'], [180, '3分ごと']]
const MAX_FRAMES = 30

// 画面の静止画を「本人が選んだ範囲」から、決めた間隔で撮る。画像はこのタブのメモリの中だけ。
export default function ScanClient() {
  const router = useRouter()
  const [minutes, setMinutes] = useState(5)
  const [every, setEvery] = useState(30)
  const [phase, setPhase] = useState('idle')   // idle → running → sending → done
  const [count, setCount] = useState(0)
  const [left, setLeft] = useState(0)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const r = useRef({ stream: null, video: null, frames: [], timer: null, tick: null, endsAt: 0, startedAt: null, granularity: 'window' })

  useEffect(() => () => stopStream(), [])

  function stopStream() {
    const x = r.current
    clearInterval(x.timer); clearInterval(x.tick)
    x.stream?.getTracks().forEach(t => t.stop())
    x.stream = null
  }

  function grab() {
    const x = r.current
    const v = x.video
    if (!v || !v.videoWidth) return
    const scale = Math.min(1, 1280 / v.videoWidth)   // 軽くするため横1280pxまでに縮める
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    x.frames.push(c.toDataURL('image/jpeg', 0.7))
    setCount(x.frames.length)
    if (x.frames.length >= MAX_FRAMES) finish()
  }

  async function start() {
    setErr(''); setRes(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const x = r.current
      x.stream = stream; x.frames = []; x.finishing = false; setCount(0)
      const surface = stream.getVideoTracks()[0].getSettings().displaySurface
      x.granularity = surface === 'monitor' ? 'screen' : 'window'
      const v = document.createElement('video'); v.srcObject = stream; v.muted = true; await v.play()
      x.video = v
      x.startedAt = new Date().toISOString()
      x.endsAt = Date.now() + minutes * 60_000
      stream.getVideoTracks()[0].addEventListener('ended', () => finish())   // ブラウザの「共有を停止」でも終わる
      setPhase('running')
      setTimeout(grab, 1500)
      x.timer = setInterval(grab, every * 1000)
      x.tick = setInterval(() => {
        const s = Math.max(0, Math.round((x.endsAt - Date.now()) / 1000)); setLeft(s)
        if (s <= 0) finish()
      }, 1000)
    } catch (e) {
      setErr('画面を選ぶのをやめたか、ブラウザが許可しませんでした')
    }
  }

  async function finish() {
    const x = r.current
    if (x.finishing || !x.stream) return   // 時間切れ・共有停止・ボタンが重なっても1回だけ
    x.finishing = true
    stopStream()
    const frames = x.frames; x.frames = []   // ★ 送ったら手元からも消す
    if (frames.length < 2) { setPhase('idle'); setErr('静止画が2枚以上たまる前に終わりました。もう少し長めにしてください'); return }
    setPhase('sending')
    try {
      const resp = await fetch('/api/selfscan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ frames, started_at: x.startedAt, ends_at: new Date(x.endsAt).toISOString(), granularity: x.granularity }),
      })
      const j = await resp.json()
      if (j.error) setErr(j.error); else setRes(j)
    } catch (e) { setErr(String(e)) }
    setPhase('done'); router.refresh()
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0')
  return (
    <div className="card sh" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {phase === 'idle' || phase === 'done' ? <>
        <div className="ttl">① 終わる時間と、撮る間隔を決める</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DURATIONS.map(([v, l]) => <button key={v} className={'tab' + (minutes === v ? ' tabon' : '')} onClick={() => setMinutes(v)}>{l}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {INTERVALS.map(([v, l]) => <button key={v} className={'tab' + (every === v ? ' tabon' : '')} onClick={() => setEvery(v)}>{l}</button>)}
        </div>
        <span className="sub">最大{MAX_FRAMES}枚まで。およそ {Math.min(MAX_FRAMES, Math.floor(minutes * 60 / every) + 1)}枚 撮ります</span>
        <div className="ttl">② 映す画面を選んで始める</div>
        <span className="sub">ボタンを押すとブラウザが「どの画面を共有するか」を聞きます。ウィンドウ1つだけを選ぶのがおすすめです</span>
        <button className="btn btn-p" onClick={start} style={{ alignSelf: 'flex-start' }}><Icon name="scan" /> 画面を選んで始める</button>
      </> : null}

      {phase === 'running' && <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="chip" style={{ background: 'var(--live)', color: '#FFF' }}><span className="dot" style={{ background: '#FFF' }} />撮影中</span>
          <span className="kpi" style={{ fontSize: 30 }}>{mm}:{ss}</span>
          <span className="sub">撮った静止画 {count}枚（このタブの中だけにあります）</span>
        </div>
        <button className="btn" onClick={finish} style={{ alignSelf: 'flex-start' }}>ここで終えて分析する</button>
      </>}

      {phase === 'sending' && <div className="note">自己分析エージェントが1枚ずつ見ています…（数十秒かかります）</div>}
      {err && <div className="err">{err}</div>}
      {res && <>
        <div className="note">{res.ok ? '分析が終わりました。見つかったタグは非公開で付いています。プロフィールで「採用」すると公開になります' : '分析の途中で止まりました'}</div>
        <pre className="mono" style={{ background: 'var(--ai)', color: '#EDE4D0', padding: 12, borderRadius: 10, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{res.log}</pre>
      </>}
    </div>
  )
}
