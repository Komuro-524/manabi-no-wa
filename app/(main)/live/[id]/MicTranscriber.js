'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/icons'

// デモ用の「マイクで話す」。ブラウザの音声認識（Web Speech API）で文字にして、確定した一文だけサーバーへ送る。
// ★ 音声そのものはまなびのわに届かない・保存しない。送るのは確定した文字だけ
// ★ 他の参加者に声は届かない（音声通話は DESIGN.md §11 の将来構成）
export default function MicTranscriber({ liveId }) {
  const router = useRouter()
  const [supported, setSupported] = useState(true)
  const [consent, setConsent] = useState(false)
  const [asking, setAsking] = useState(false)
  const [on, setOn] = useState(false)
  const [interim, setInterim] = useState('')
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(0)
  const recRef = useRef(null)
  const wantRef = useRef(false)

  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) setSupported(false)
    return () => { wantRef.current = false; try { recRef.current?.abort() } catch {} }
  }, [])

  async function post(text) {
    const res = await fetch(`/api/lives/${liveId}/segments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    }).catch(() => null)
    if (!res) { setErr('送れませんでした（ネットワーク）'); return }
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error ?? '送れませんでした'); if (res.status === 403 || res.status === 409) stop(); return }
    setSent(n => n + 1)
    router.refresh()
  }

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'ja-JP'; rec.continuous = true; rec.interimResults = true
    rec.onresult = e => {
      let tmp = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) { const t = r[0].transcript.trim(); if (t) post(t) }
        else tmp += r[0].transcript
      }
      setInterim(tmp)
    }
    rec.onerror = e => {
      const msg = {
        'not-allowed': 'マイクの使用が許可されていません（アドレスバーの🔒から許可できます）',
        'service-not-allowed': 'このブラウザでは音声認識が使えません',
        'network': '音声認識のサーバーに届きません（社内ネットワークで止められている可能性があります）',
        'audio-capture': 'マイクが見つかりません',
      }[e.error]
      if (msg) { setErr(msg); wantRef.current = false }
    }
    // Chrome は無音が続くと自分で止まるので、話し中のあいだは付け直す
    rec.onend = () => { setInterim(''); if (wantRef.current) { try { rec.start() } catch {} } else setOn(false) }
    recRef.current = rec
    wantRef.current = true
    setErr(''); setOn(true)
    try { rec.start() } catch { setErr('マイクを始められませんでした'); setOn(false); wantRef.current = false }
  }
  function stop() { wantRef.current = false; try { recRef.current?.stop() } catch {}; setOn(false); setInterim('') }

  if (!supported) return <div className="note">このブラウザは音声入力に対応していません（Chrome か Edge で開いてください）</div>

  return (
    <div className="card" style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 9, borderColor: on ? 'var(--live)' : undefined }}>
      <b style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>🎙️ マイクで話す<span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)', padding: '1px 7px', fontSize: 11 }}>デモ</span></b>
      {asking && !consent && (
        <div className="note" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span>・声はブラウザの音声認識サービス（Chrome なら Google、Edge なら Microsoft）で文字になります</span>
          <span>・まなびのわに届くのは確定した文字だけです。声は保存しません</span>
          <span>・文字は参加者に見え、ライブ後にタグ付けエージェントが読んで知見カードにします</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-p btn-s" onClick={() => { setConsent(true); setAsking(false); start() }}>同意して話し始める</button>
            <button className="btn btn-s" onClick={() => setAsking(false)}>やめる</button>
          </span>
        </div>
      )}
      {!asking && (on
        ? <button className="btn btn-s" onClick={stop} style={{ width: '100%', borderColor: 'var(--live)', color: 'var(--live)' }}><span className="dot talking" style={{ background: 'var(--live)' }} /> 話すのをやめる</button>
        : <button className="btn btn-p btn-s" onClick={() => consent ? start() : setAsking(true)} style={{ width: '100%' }}>マイクをオンにする</button>)}
      {on && <span className="sub" style={{ minHeight: 18, fontStyle: interim ? 'italic' : undefined }}>{interim || '聞き取り中…'}</span>}
      {sent > 0 && <span className="sub" style={{ fontSize: 11 }}>確定した発言 {sent} 件を記録しました</span>}
      {err && <div className="err">{err}</div>}
      <span className="sub" style={{ fontSize: 11 }}>声は他の参加者には届きません。文字だけが共有されます</span>
    </div>
  )
}
