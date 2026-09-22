'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ライブのタネの「いま1周動かす」と、場づくりエージェントが動いている様子。
// 動いている間は、麦わら帽子の畑番が畝（うね）を左右に歩き、いま見ているタネと決めたことを吹き出しで話す。
// ★ エージェントは裏で動く（数十秒〜数分）。進み具合は agent_runs と quest_steps を数秒おきに読み直して出す
const DECISION = { open: '立てる', wait: '待つ', skip: '見送る', sent: '相談した', accepted: '引き受けてもらった', opened: '予約した', done: '開催した' }

export default function FieldWorker({ running, run, steps }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)   // 押してから、裏でエージェントが記録を書き始めるまで
  const [err, setErr] = useState('')
  const active = running || starting

  // 動いている間は3秒おきに読み直す（タブが裏にあるときは休む）
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, 3000)
    return () => clearInterval(t)
  }, [active, router])
  // 記録が「動いている」になったら 押した直後の状態は終わり。1分たっても始まらなければ知らせる
  useEffect(() => { if (running) setStarting(false) }, [running])
  useEffect(() => {
    if (!starting) return
    const t = setTimeout(() => { setStarting(false); setErr('1分たっても始まりませんでした。もう一度押すか、エージェントの画面で失敗が無いか確かめてください') }, 60_000)
    return () => clearTimeout(t)
  }, [starting])

  async function go() {
    setErr(''); setStarting(true)
    try {
      const r = await fetch('/api/admin/organizer', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) { setStarting(false); setErr(j.error ?? '動かせませんでした') }
      router.refresh()
    } catch (e) { setStarting(false); setErr(String(e)) }
  }

  const latest = steps[0]
  const talk = starting && !running
    ? '畑に向かっています…'
    : latest
      ? `＃${latest.tag}：${DECISION[latest.decision] ?? latest.decision}。${latest.reason}`
      : 'タネを1つずつ見回っています。興味の集まり方と、話せる人がいるかを確かめています…'
  const count = steps.reduce((m, s) => (m[s.decision] = (m[s.decision] ?? 0) + 1, m), {})
  const done = !active && run?.finished_at

  return (
    <div className="field" aria-live="polite">
      <div className="field-head">
        {active
          ? <span className="chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 13, padding: '7px 12px' }}>
              <span className="spin" style={{ width: 12, height: 12, borderRadius: 999, border: '2px solid var(--amber)', borderTopColor: 'transparent' }} />
              場づくりエージェントが見回り中{running && run?.started_at ? `（${elapsed(run.started_at)}）` : ''}</span>
          : <button className="btn btn-p btn-s" onClick={go}>いま1周見回ってもらう</button>}
        <span className="sub">
          {active
            ? 'タネごとに「立てる／待つ／見送る」を決めています。1周に数十秒〜数分かかります'
            : done
              ? `前回 ${fmt(run.finished_at)} に見回り済み${steps.length ? `：${Object.entries(count).map(([k, v]) => `${DECISION[k] ?? k}${v}`).join('・')}` : '（変化なし）'}`
              : run ? `前回 ${fmt(run.started_at)}` : 'まだ一度も見回っていません'}
        </span>
        {err && <span className="err" style={{ padding: '6px 10px' }}>{err}</span>}
      </div>
      {active && (
        <div className="field-row">
          <div className="farmer">
            <div className="farmer-talk">{talk}</div>
            <Farmer />
          </div>
        </div>
      )}
      {!active && done && steps.length > 0 && (
        <ul className="field-log">
          {steps.slice(0, 3).map((s, i) => <li key={i}><b>＃{s.tag}</b>：{DECISION[s.decision] ?? s.decision} — {s.reason}</li>)}
        </ul>
      )}
    </div>
  )
}

const fmt = iso => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const elapsed = iso => { const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000)); return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒` }

// 麦わら帽子の畑番（オリジナル）。じょうろを持って歩く
function Farmer() {
  return (
    <svg className="farmer-body" width="76" height="90" viewBox="0 0 54 64" aria-hidden="true">
      <g className="farmer-legs">
        <rect className="leg-a" x="20" y="44" width="5" height="16" rx="2.5" fill="#3A4A5E" />
        <rect className="leg-b" x="28" y="44" width="5" height="16" rx="2.5" fill="#2E3B4C" />
      </g>
      <rect x="16" y="28" width="22" height="20" rx="7" fill="#1C2B3D" />
      <rect x="23" y="30" width="8" height="12" rx="2" fill="#E0B84A" opacity=".85" />
      <circle cx="27" cy="21" r="8" fill="#F1C9A5" />
      <circle cx="30" cy="20" r="1.1" fill="#3A2A1E" />
      <path d="M28 24q2 1.5 4 0" stroke="#3A2A1E" strokeWidth="1" fill="none" strokeLinecap="round" />
      <ellipse cx="27" cy="15" rx="15" ry="3.4" fill="#D8B45A" />
      <path d="M19 15q8-11 16 0z" fill="#E6C66E" />
      <rect x="19" y="13" width="16" height="2.4" fill="#A83B2E" />
      <g className="farmer-can">
        <path d="M38 36h9v9h-9z" fill="#6E8B9E" rx="1" />
        <path d="M47 38l6-4" stroke="#6E8B9E" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M36 34q2-3 6 0" stroke="#6E8B9E" strokeWidth="1.6" fill="none" />
        <path d="M36 33l2 4" stroke="#1C2B3D" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  )
}
