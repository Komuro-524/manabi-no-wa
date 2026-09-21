'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import StatusBar from './StatusBar'

// 自己分析の撮影と分析を、画面をまたいでも続けるための入れ物（アプリの外枠に1つだけ置く）。
// ★ 画像はこのタブのメモリの中だけ。送ったら手元からも消す。ページを再読み込みすると撮影は止まる
const Ctx = createContext(null)
export const useScan = () => useContext(Ctx)
const MAX_FRAMES = 30

function notify(body) {
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification('まなびのわ', { body, icon: '/logo.png' }) } catch {}
}

export default function ScanProvider({ children }) {
  const router = useRouter()
  const [phase, setPhase] = useState('idle')   // idle → running → sending → done
  const [count, setCount] = useState(0)
  const [left, setLeft] = useState(0)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const r = useRef({ stream: null, video: null, frames: [], timer: null, tick: null, endsAt: 0, startedAt: null, granularity: 'window', finishing: false })

  useEffect(() => () => stopStream(), [])

  function stopStream() {
    const x = r.current
    clearInterval(x.timer); clearInterval(x.tick)
    x.stream?.getTracks().forEach(t => t.stop())
    x.stream = null
  }

  function grab() {
    const x = r.current, v = x.video
    if (!v || !v.videoWidth) return
    const scale = Math.min(1, 1280 / v.videoWidth)   // 軽くするため横1280pxまでに縮める
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    x.frames.push(c.toDataURL('image/jpeg', 0.7))
    setCount(x.frames.length)
    if (x.frames.length >= MAX_FRAMES) finish('枚数の上限')
  }

  async function start(minutes, every) {
    setErr(''); setRes(null)
    try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission() } catch {}
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const x = r.current
      x.stream = stream; x.frames = []; x.finishing = false; setCount(0)
      x.granularity = stream.getVideoTracks()[0].getSettings().displaySurface === 'monitor' ? 'screen' : 'window'
      const v = document.createElement('video'); v.srcObject = stream; v.muted = true; await v.play()
      x.video = v
      x.startedAt = new Date().toISOString()
      x.endsAt = Date.now() + minutes * 60_000
      stream.getVideoTracks()[0].addEventListener('ended', () => finish('共有の停止'))
      setPhase('running'); setLeft(minutes * 60)
      setTimeout(grab, 1500)
      x.timer = setInterval(grab, every * 1000)
      x.tick = setInterval(() => {
        const s = Math.max(0, Math.round((x.endsAt - Date.now()) / 1000)); setLeft(s)
        if (s <= 0) finish('時間になった')
      }, 1000)
    } catch {
      setErr('画面を選ぶのをやめたか、ブラウザが許可しませんでした')
    }
  }

  async function finish(why) {
    const x = r.current
    if (x.finishing || !x.stream) return   // 時間切れ・共有停止・ボタンが重なっても1回だけ
    x.finishing = true
    stopStream()
    const frames = x.frames; x.frames = []
    if (frames.length < 2) { setPhase('idle'); setErr('静止画が2枚以上たまる前に終わりました。もう少し長めにしてください'); return }
    setPhase('sending')
    notify(`自己分析の撮影が終わりました（${why}）。分析しています`)
    try {
      const resp = await fetch('/api/selfscan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ frames, started_at: x.startedAt, ends_at: new Date(x.endsAt).toISOString(), granularity: x.granularity }),
      })
      const j = await resp.json()
      if (j.error) setErr(j.error); else setRes(j)
      notify(j.error ? '自己分析が止まりました' : '自己分析が終わりました。見つかったタグを確かめてください')
    } catch (e) { setErr(String(e)) }
    setPhase('done'); router.refresh()
  }

  const reset = () => { setPhase('idle'); setRes(null); setErr('') }
  return <Ctx.Provider value={{ phase, count, left, res, err, start, finish, reset, MAX_FRAMES }}>{children}</Ctx.Provider>
}

// どの画面にいても出る帯
export function ScanBanner() {
  const s = useScan()
  const path = usePathname()
  if (!s || s.phase === 'idle') return null
  const mm = String(Math.floor(s.left / 60)).padStart(2, '0'), ss = String(s.left % 60).padStart(2, '0')
  const go = path !== '/selfscan' ? <Link className="btn btn-s" href="/selfscan">自己分析を開く</Link> : null
  return (
    // 画面の流れに入れず、右上に浮かせる（ほかの表示を押し下げない）
    <div style={{ position: 'fixed', top: 72, right: 20, width: 'min(520px, calc(100vw - 40px))', zIndex: 60, boxShadow: '0 10px 28px rgba(28,43,61,.22)', borderRadius: 12 }}>
      {s.phase === 'running' && <StatusBar tone="info" title={`自己分析 撮影中 ${mm}:${ss}`} text={`撮った静止画 ${s.count}枚。ほかの画面に移っても続きます（再読み込みすると止まります）`}>
        <button className="btn btn-s" onClick={() => s.finish('途中で終えた')}>ここで終えて分析する</button>{go}</StatusBar>}
      {s.phase === 'sending' && <StatusBar spinning title="自己分析エージェントが分析中です" text="1枚ずつ見て、何枚に映ったかを数えています（数十秒）">{go}</StatusBar>}
      {s.phase === 'done' && <StatusBar tone={s.err ? 'warn' : 'ok'} title={s.err ? '自己分析が止まりました' : '自己分析が終わりました'} text={s.err || '見つかったタグは非公開で付いています。プロフィールで「採用」すると公開になります'}>
        {path !== '/selfscan' ? go : null}<Link className="btn btn-s" href="/profile?tab=knowledge">プロフィールで見る</Link>
        <button className="btn btn-s" onClick={s.reset}>閉じる</button></StatusBar>}
    </div>
  )
}
