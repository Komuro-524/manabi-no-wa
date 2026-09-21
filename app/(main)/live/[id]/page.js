import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'
import LiveActions from './LiveActions'

export default async function LivePage({ params }) {
  const { id } = await params
  const liveId = Number(id)
  const me = await currentUser()
  const db = await supabaseServer()

  const { data: l } = await db.from('lives')
    .select('id, title, status, scheduled_start, started_at, ended_at, ingest_status, tags(name)')
    .eq('id', liveId).maybeSingle()
  if (!l) notFound()

  const [{ data: ps }, { data: users }, { data: msgs }, { data: cards }] = await Promise.all([
    db.from('live_participants').select('user_id, role').eq('live_id', liveId),
    db.from('users').select('id, display_name, department'),
    db.from('messages').select('id, user_id, body, is_agent, created_at').eq('live_id', liveId).order('id'),     // RLS: 参加者だけ
    db.from('knowledge_cards').select('id, headline, body, speaker_id, tag_id, tags(name, status)').eq('live_id', liveId).order('id'), // RLS: 正式タグ or 本人 or 管理者
  ])
  const who = new Map((users ?? []).map(u => [u.id, u]))
  const amIn = (ps ?? []).some(p => p.user_id === me.id)
  const speakers  = (ps ?? []).filter(p => p.role === 'speaker')
  const listeners = (ps ?? []).filter(p => p.role !== 'speaker')

  // 生まれたタグごとにカードをまとめる。タグ名が読めない＝まだ育ちかけ（候補）のタグ
  const groups = new Map()
  for (const c of cards ?? []) {
    const key = c.tags?.name ?? '（育ちかけのタグ）'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }

  const { main, sub } = splitTitle(l.title)
  const statusText = l.status === 'live' ? 'いま配信中' : l.status === 'scheduled' ? `${fmtWhen(l.scheduled_start)} から` : `${fmtWhen(l.ended_at ?? l.started_at)} に終了`

  return (
    <>
      <Topbar me={me} title={`＃${main}`} sub={`${sub ? sub + ' ・ ' : ''}${statusText}`}>
        <Link className="btn btn-s" href="/livehub"><Icon name="back" size={14} /> 一覧へ</Link>
      </Topbar>
      <div className="body" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
        {/* 左: 会話 */}
        <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ttl">チャット</div>
            {!amIn && <div className="note">チャットと元の発言は、このライブに参加した人だけが読めます（参加していない人にはデータベースが渡しません）</div>}
            {amIn && (msgs ?? []).length === 0 && <div className="empty">まだ発言はありません</div>}
            {(msgs ?? []).map(m => (
              <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {m.is_agent
                  ? <span className="avt" style={{ width: 30, height: 30, background: 'var(--amber-bg)', color: 'var(--amber)' }}><Icon name="robot" size={16} /></span>
                  : <span className="avt" style={{ width: 30, height: 30, fontSize: 14 }}>{who.get(m.user_id)?.display_name?.slice(0, 1) ?? '?'}</span>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="sub" style={{ fontWeight: 600 }}>{m.is_agent ? '場づくりエージェント' : who.get(m.user_id)?.display_name ?? '?'}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.6 }}>{m.body}</span>
                </div>
              </div>
            ))}
            <LiveActions liveId={liveId} status={l.status} amIn={amIn} meId={me.id} />
          </div>
        </div>

        {/* 右: 参加者と、このライブから生まれたもの */}
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ttl">参加者</div>
            <span className="sub">スピーカー</span>
            {speakers.length ? speakers.map(p => <Person key={p.user_id} u={who.get(p.user_id)} />) : <span className="sub">未定</span>}
            {listeners.length > 0 && <><span className="sub" style={{ paddingTop: 6 }}>リスナー</span>{listeners.map(p => <Person key={p.user_id} u={who.get(p.user_id)} />)}</>}
          </div>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ttl">このライブから生まれたもの</div>
            {l.status !== 'ended' && <span className="sub">ライブが終わると、タグ付けエージェントが知見カードを作ります</span>}
            {l.status === 'ended' && groups.size === 0 && <span className="sub">{l.ingest_status === 'done' ? 'あなたに見えるカードはまだありません（育ちかけのタグは、管理者が正式にすると全員に見えます）' : 'まだ取り込まれていません'}</span>}
            {[...groups].map(([tag, cs]) => (
              <div key={tag} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="chip" style={{ alignSelf: 'flex-start', background: 'var(--blue-bg)', color: 'var(--blue)' }}><Icon name="tag" size={13} />{tag}</span>
                {cs.map(c => (
                  <div key={c.id} style={{ borderLeft: '3px solid var(--line)', paddingLeft: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.headline}</div>
                    <div className="sub">{c.body}</div>
                    <div className="sub">話した人: {who.get(c.speaker_id)?.display_name ?? '?'}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function Person({ u }) {
  if (!u) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span className="avt" style={{ width: 28, height: 28, fontSize: 13 }}>{u.display_name.slice(0, 1)}</span>
      <span style={{ fontSize: 13 }}>{u.display_name}<span className="sub"> ・ {u.department}</span></span>
    </div>
  )
}
