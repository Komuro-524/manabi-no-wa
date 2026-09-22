'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ライブのタネの「いま1周動かす」と、場づくりエージェントが動いている様子。
// 動いている間は、麦わら帽子の畑番が畝（うね）を左右に歩き、いま見ているタネと決めたことを吹き出しで話す。
// ★ エージェントは裏で動く（数十秒〜数分）。進み具合は agent_runs と quest_steps を数秒おきに読み直して出す
const DECISION = { open: '立てる', wait: '待つ', skip: '見送る', sent: '相談した', accepted: '引き受けてもらった', opened: '予約した', done: '開催した' }

export default function FieldWorker({ running, run, steps }) {
  const router = useRouter()
  const [starting, setStarting] = useState(null)   // 押した時刻。裏でエージェントが記録を書き始めるまで
  const [err, setErr] = useState('')
  const active = running || !!starting

  // 動いている間は3秒おきに読み直す（タブが裏にあるときは休む）
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, 3000)
    return () => clearInterval(t)
  }, [active, router])
  // 押したあとに新しい周の記録が現れたら（動いている／もう終わった のどちらでも）押した直後の状態は終わり。
  // ★ 早い周は、画面が「動いている」を読む前に終わってしまうことがある。開始時刻で見分ける
  const fresh = starting && run?.started_at && new Date(run.started_at).getTime() >= starting - 5000
  useEffect(() => { if (running || fresh) setStarting(null) }, [running, fresh])
  useEffect(() => {
    if (!starting) return
    const t = setTimeout(() => { setStarting(null); setErr('1分たっても始まりませんでした。もう一度押すか、エージェントの画面で失敗が無いか確かめてください') }, 60_000)
    return () => clearTimeout(t)
  }, [starting])

  async function go() {
    setErr(''); setStarting(Date.now())
    try {
      const r = await fetch('/api/admin/organizer', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) { setStarting(null); setErr(j.error ?? '動かせませんでした') }
      router.refresh()
    } catch (e) { setStarting(null); setErr(String(e)) }
  }

  const latest = steps[0]
  const talk = starting && !running
    ? '畑に向かっています…'
    : latest
      ? `＃${latest.tag}：${DECISION[latest.decision] ?? latest.decision}。${latest.reason}`
      : 'タネを1つずつ見回っています。興味の集まり方と、話せる人がいるかを確かめています…'
  const count = steps.reduce((m, s) => (m[s.decision] = (m[s.decision] ?? 0) + 1, m), {})
  const done = !active && run?.finished_at

  // ★ プランターの位置は動かさない。ボタンの右に小さな畝を1本だけ置き、そこを畑番が歩く
  const last = steps.slice(0, 3).map(x => `＃${x.tag}：${DECISION[x.decision] ?? x.decision}（${x.reason}）`).join('\n')
  return (
    <div className="field-head" aria-live="polite">
      {active
        ? <span className="chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 13, padding: '7px 12px' }}>
            見回り中{running && run?.started_at ? `（${elapsed(run.started_at)}）` : ''}</span>
        : <button className="btn btn-p btn-s" onClick={go}>いま1周見回ってもらう</button>}
      {active && <span className="field-lane" aria-hidden="true"><span className="farmer">🧑‍🌾</span></span>}
      <span className="sub field-talk" title={active ? talk : last}>
        {active
          ? talk
          : done
            ? `前回 ${fmt(run.finished_at)} に見回り済み${steps.length ? `：${Object.entries(count).map(([k, v]) => `${DECISION[k] ?? k}${v}`).join('・')}（詳しくは各タネの足あと）` : '（変化なし）'}`
            : run ? `前回 ${fmt(run.started_at)}` : 'まだ一度も見回っていません'}
      </span>
      {err && <span className="err" style={{ padding: '6px 10px' }}>{err}</span>}
    </div>
  )
}

const fmt = iso => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const elapsed = iso => { const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000)); return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒` }
