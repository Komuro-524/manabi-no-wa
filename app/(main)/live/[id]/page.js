import Link from '@/components/Link'
import { notFound } from 'next/navigation'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { ownTagNames } from '@/lib/own-tag-names'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'
import LiveActions from './LiveActions'
import AdminRunButton from '@/components/AdminRunButton'
import StatusBar from '@/components/StatusBar'
import AutoRefresh from '@/components/AutoRefresh'
import LivePanels from './LivePanels'
import Elapsed from './Elapsed'
import MicTranscriber from './MicTranscriber'
import { usersByIds } from '@/lib/users-by-id'

export default async function LivePage({ params }) {
  const { id } = await params
  const liveId = Number(id)
  const me = await currentUser()
  const db = await supabaseServer()

  const { data: l } = await db.from('lives')
    .select('id, title, status, scheduled_start, started_at, ended_at, ingest_status, topic_tag_id, tags(name)')
    .eq('id', liveId).maybeSingle()
  if (!l) notFound()

  const [{ data: ps }, { data: msgs }, { data: cards }, { data: segs }] = await Promise.all([
    db.from('live_participants').select('user_id, role').eq('live_id', liveId),
    db.from('messages').select('id, user_id, body, is_agent, created_at').eq('live_id', liveId).order('id'),     // RLS: 参加者だけ
    db.from('knowledge_cards').select('id, headline, body, speaker_id, tag_id, tags(name, status)').eq('live_id', liveId).order('id'), // RLS: 正式タグ or 本人 or 管理者
    db.from('transcript_segments').select('id, user_id, seq, body, spoken_at').eq('live_id', liveId).order('seq'),   // RLS: 参加者だけ
  ])
  // 画面に出てくる人（参加者・発言した人・カードの話し手）だけを読む
  const who = await usersByIds(db, [...(ps ?? []).map(p => p.user_id), ...(msgs ?? []).map(m => m.user_id), ...(segs ?? []).map(s => s.user_id), ...(cards ?? []).map(c => c.speaker_id)])
  // 自分が話したカードのうち、育ちかけでタグ名が読めないものは名前だけ引く（自分の行の tag_id に限る）
  const ownMissing = (cards ?? []).filter(c => !c.tags && c.speaker_id === me.id).map(c => c.tag_id)
  if (ownMissing.length) {
    const names = await ownTagNames(ownMissing)
    for (const c of cards ?? []) if (!c.tags && c.speaker_id === me.id && names.has(c.tag_id)) c.tags = names.get(c.tag_id)
  }
  const amIn = (ps ?? []).some(p => p.user_id === me.id)
  const speakers  = (ps ?? []).filter(p => p.role === 'speaker')
  const listeners = (ps ?? []).filter(p => p.role !== 'speaker')

  // 生まれたタグごとにカードをまとめる。タグ名が読めない＝まだ育ちかけ（候補）のタグ
  const groups = new Map()
  for (const c of cards ?? []) {
    const key = !c.tags ? '（育ちかけのタグ）' : c.tags.status === 'official' ? c.tags.name : `${c.tags.name}（育ちかけ）`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }

  const { main, sub } = splitTitle(l.title)

  // タグ付けエージェントの進み具合（ライブを終えた直後だけ数秒おきに読み直す）
  const endedRecently = l.status === 'ended' && l.ended_at && Date.now() - new Date(l.ended_at).getTime() < 15 * 60 * 1000
  const working = endedRecently && ['pending', 'running'].includes(l.ingest_status)
  const ingestBar = l.status !== 'ended' ? null
    : l.ingest_status === 'running' ? <StatusBar spinning title="タグ付けエージェントが取り込み中です" text="チャットと発言を読んで、知見カードとタグの候補を作っています（数十秒）" />
    : l.ingest_status === 'pending' && endedRecently ? <StatusBar spinning title="タグ付けの順番待ちです" text="まもなくタグ付けエージェントが取り込みを始めます" />
    : l.ingest_status === 'needs_review' ? <StatusBar tone="warn" title="人の確認待ちです" text="取り込みが途中で止まったか、確かめが必要な行がありました。二重に書かないよう、エージェントは自分でやり直しません" />
    : l.ingest_status === 'failed' ? <StatusBar tone="warn" title="取り込みに失敗しました" text="管理者ビューのセキュリティ画面で理由を確かめられます" />
    : l.ingest_status === 'done' && endedRecently ? (groups.size
      ? <StatusBar tone="ok" title="タグ付けが終わりました" text={`このライブから知見カードが生まれました。右の「生まれたタグ」で見られます`} />
      : <StatusBar tone="info" title="タグ付けが終わりました" text="今回は知見カードになる話はありませんでした（あいさつや雑談だけのときは作りません）" />)
    : null
  const statusText = l.status === 'live' ? 'いま配信中' : l.status === 'scheduled' ? `${fmtWhen(l.scheduled_start)} から` : `${fmtWhen(l.ended_at ?? l.started_at)} に終了`

  // コメントと「マイクで話した発言」（文字起こし）を時刻順に1本に並べる
  // ★ 音声通話は今回の範囲外（DESIGN.md §11）。デモではブラウザの音声入力で文字だけを共有する
  const timeline = [
    ...(msgs ?? []).map(m => ({ kind: 'msg', key: `m${m.id}`, at: m.created_at, ...m })),
    ...(segs ?? []).map(s => ({ kind: 'seg', key: `s${s.id}`, at: s.spoken_at ?? l.started_at, ...s })),
  ].sort((a, b) => new Date(a.at ?? 0) - new Date(b.at ?? 0))
  // 「いま話している人」は、いちばん新しい人の発言（コメントかマイク）の人で示す
  const lastHuman = [...timeline].reverse().find(t => !t.is_agent)
  const talkingId = lastHuman?.user_id ?? null
  const talkingFresh = l.status === 'live' && lastHuman?.at && Date.now() - new Date(lastHuman.at).getTime() < 3 * 60 * 1000

  // 話し手ごとに添えるタグ（このライブの話題のタグを持っていればそれ、なければ公開している知見タグを1つ）
  const spIds = speakers.map(p => p.user_id)
  const { data: spTags } = spIds.length
    ? await db.from('user_tags').select('user_id, tag_id, tags(name, status)').in('user_id', spIds).eq('kind', 'knowledge')
    : { data: [] }
  const tagOf = id => {
    const mine = (spTags ?? []).filter(t => t.user_id === id && t.tags?.status === 'official')
    return (mine.find(t => t.tag_id === l.topic_tag_id) ?? mine[0])?.tags?.name ?? null
  }
  const isSpeaker = speakers.some(p => p.user_id === me.id)
  const canRun = (me.role === 'admin' || isSpeaker) && (l.status === 'scheduled' || l.status === 'live')

  const commentPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flexGrow: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', flexGrow: 1, minHeight: 0 }}>
        {!amIn && <div className="note">コメントと元の発言は、このライブに参加した人だけが読めます（参加していない人にはデータベースが渡しません）</div>}
        {amIn && timeline.length === 0 && <div className="empty">まだコメントはありません</div>}
        {timeline.map(m => m.kind === 'seg' ? (
          <div key={m.key} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: 'var(--blue-bg)', borderRadius: 12 }}>
            <span className="avt" style={{ width: 32, height: 32, fontSize: 15 }}>{who.get(m.user_id)?.display_name?.slice(0, 1) ?? '?'}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><b style={{ fontSize: 14 }}>{who.get(m.user_id)?.display_name ?? '?'}</b><span className="chip" style={{ background: '#FFF', color: 'var(--blue)', padding: '1px 7px', fontSize: 11 }}>🎙️ 話した言葉</span>{m.spoken_at && <span className="sub">{fmtWhen(m.spoken_at)}</span>}</span>
              <span style={{ fontSize: 13, lineHeight: 1.6 }}>{m.body}</span>
            </span>
          </div>
        ) : m.is_agent ? (
          <div key={m.key} style={{ display: 'flex', gap: 10, padding: 12, background: 'var(--shu-bg)', borderRadius: 12 }}>
            <span className="avt" style={{ width: 32, height: 32, background: 'var(--shu)', color: '#FFF' }}><Icon name="robot" size={16} /></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span className="chip" style={{ background: 'var(--shu-bg)', color: 'var(--shu)', padding: '2px 8px' }}>場づくりエージェント</span>
                <span className="sub">{fmtWhen(m.created_at)}</span>
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.65 }}>{m.body}</span>
            </span>
          </div>
        ) : (
          <div key={m.key} style={{ display: 'flex', gap: 10, padding: '6px 2px' }}>
            <span className="avt" style={{ width: 32, height: 32, fontSize: 15 }}>{who.get(m.user_id)?.display_name?.slice(0, 1) ?? '?'}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><b style={{ fontSize: 14 }}>{who.get(m.user_id)?.display_name ?? '?'}</b><span className="sub">{fmtWhen(m.created_at)}</span></span>
              <span style={{ fontSize: 13, lineHeight: 1.6 }}>{m.body}</span>
            </span>
          </div>
        ))}
      </div>
      <LiveActions liveId={liveId} status={l.status} amIn={amIn} meId={me.id} />
    </div>
  )
  const cardsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flexGrow: 1, minHeight: 0 }}>
      {l.status !== 'ended' && <span className="sub">ライブが終わると、タグ付けエージェントがコメントと発言を読んで知見カードを作ります</span>}
      {l.status === 'ended' && groups.size === 0 && <span className="sub">{l.ingest_status === 'done' ? 'あなたに見えるカードはまだありません（育ちかけのタグは、管理者が正式にすると全員に見えます）' : 'まだ取り込まれていません'}</span>}
      {[...groups].map(([tag, cs]) => (
        <div key={tag} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="chip" style={{ alignSelf: 'flex-start', background: 'var(--blue-bg)', color: 'var(--blue)' }}><Icon name="tag" size={13} />{tag}</span>
          {cs.map(c => (
            <Link key={c.id} href={`/cards?id=${c.id}`} className="topic" style={{ color: 'var(--ink)' }}>
              <b style={{ fontSize: 14 }}>{c.headline}</b>
              <span className="sub">{c.body}</span>
              <span className="sub" style={{ fontSize: 11 }}>話した人: {who.get(c.speaker_id)?.display_name ?? '?'}</span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <>
      <header className="topbar" style={{ height: 'auto', padding: '14px 24px', gap: 14, flexWrap: 'wrap' }}>
        {l.status === 'live'
          ? <span className="chip" style={{ background: 'var(--live)', color: '#FFF', padding: '7px 12px' }}><span className="dot" style={{ background: '#FFF' }} />LIVE</span>
          : <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)', padding: '7px 12px' }}>{l.status === 'scheduled' ? '配信予定' : '終了'}</span>}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>＃{main}</h1>
          {sub && <span className="sub">{sub}</span>}
        </div>
        <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)' }}><Icon name="clock" size={13} />
          {l.status === 'live' ? <Elapsed since={l.started_at} /> : statusText}</span>
        <span style={{ flexGrow: 1 }} />
        <Link className="btn btn-s" href="/livehub"><Icon name="back" size={14} /> {l.status === 'live' && amIn ? '退出' : '一覧へ'}</Link>
      </header>
      {ingestBar && <div style={{ padding: '14px 24px 0' }}>{ingestBar}</div>}
      <AutoRefresh active={working || (l.status === 'live' && amIn)} every={working ? 4000 : 6000} />
      <div className="body" style={{ flexDirection: 'row', alignItems: 'stretch', gap: 16, overflow: 'hidden' }}>
        {/* 左: 話し手を大きく。いま話している人に色の輪 */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {speakers.length === 0 && <div className="card empty">スピーカー未定</div>}
          {speakers.map(p => {
            const u = who.get(p.user_id); if (!u) return null
            const talking = p.user_id === talkingId
            const tag = tagOf(p.user_id)
            return (
              <div key={p.user_id} className="card sh" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 13, borderColor: talking ? 'var(--live)' : undefined }}>
                <span style={{ borderRadius: 999, boxShadow: talking ? '0 0 0 3px var(--live)' : 'none', flexShrink: 0 }} className={talking && talkingFresh ? 'talking' : undefined}>
                  <span className="avt" style={{ width: 56, height: 56, fontSize: 22, background: talking ? '#F5E3E8' : undefined, color: talking ? '#8A3B54' : undefined }}>{u.display_name.slice(0, 1)}</span>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{u.display_name}</span>
                  {tag && <span className="chip" style={{ alignSelf: 'flex-start', background: 'var(--blue-bg)', color: 'var(--blue)' }}><Icon name="tag" size={12} />{tag}</span>}
                  <span className="sub" style={{ fontWeight: 700, color: talking ? '#8A3B54' : undefined }}>
                    {talking ? (l.status === 'live' ? (talkingFresh ? '話しています' : '最後に話した人') : 'いちばん最後に話した人') : (l.status === 'live' ? '聞いています' : u.department)}
                  </span>
                </div>
              </div>
            )
          })}
          <div className="card" style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span className="sub" style={{ fontWeight: 700 }}>リスナー {listeners.length}人</span>
            {listeners.length > 0 && <span style={{ display: 'flex', flexWrap: 'wrap' }}>
              {listeners.slice(0, 6).map(p => <span key={p.user_id} className="avt" title={who.get(p.user_id)?.display_name} style={{ width: 28, height: 28, fontSize: 13, marginRight: -4, border: '2px solid #FFF' }}>{who.get(p.user_id)?.display_name?.slice(0, 1)}</span>)}
              {listeners.length > 6 && <span className="avt" style={{ width: 28, height: 28, fontSize: 11 }}>＋{listeners.length - 6}</span>}
            </span>}
            <span className="sub">聞くだけの参加も、正式な席です。</span>
            <button className="btn btn-s" disabled title="音声通話は将来構成（DESIGN.md §11）" style={{ width: '100%' }}>スピーカーになる（音声通話は準備中）</button>
          </div>
          {l.status === 'live' && isSpeaker && <MicTranscriber liveId={liveId} />}
          {canRun && (
            <div className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, borderColor: 'var(--ai)' }}>
              <b style={{ fontSize: 14 }}>{me.role === 'admin' ? '管理者の操作' : '話し手の操作'}</b>
              {l.status === 'scheduled'
                ? <AdminRunButton url="/api/admin/live" body={{ liveId: l.id, action: 'start' }} label="ライブを始める" small />
                : <AdminRunButton url="/api/admin/live" body={{ liveId: l.id, action: 'end' }} label="ライブを終える" busyLabel="終えています…" confirmText="ライブを終えますか？終えたあとはコメントできません" small />}
            </div>
          )}
        </div>

        {/* 右: コメント／生まれたタグ */}
        <div className="card sh" style={{ flexGrow: 1, minWidth: 0, minHeight: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <LivePanels cardsCount={groups.size} comment={commentPanel} cards={cardsPanel} initial={l.status === 'ended' && groups.size ? 'cards' : 'comment'} />
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
