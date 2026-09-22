import Link from '@/components/Link'
import { notFound, redirect } from 'next/navigation'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'

// 他の人のプロフィール（アイコンや検索結果から来る）。
// ★ 本人が「公開」にした 正式タグ だけを出す。非公開・育ちかけは、管理者が見ても ここには出さない（本人の意思を優先）
// ★ 全部 見ている人のセッションで読む ＝ RLS がそのまま効く
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PersonPage({ params }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const me = await currentUser()
  if (id === me.id) redirect('/profile')
  const db = await supabaseServer()

  const { data: u } = await db.from('users').select('id, display_name, department').eq('id', id).maybeSingle()
  if (!u) notFound()
  const [{ data: tags }, { data: cards }, { data: parts }] = await Promise.all([
    db.from('user_tags').select('tag_id, kind, visibility, tags(name, status, kind)').eq('user_id', id).eq('visibility', 'public'),
    db.from('knowledge_cards').select('id, headline, body, created_at, tag_id, tags(name, status)').eq('speaker_id', id).order('id', { ascending: false }).limit(30),
    db.from('live_participants').select('role, lives(id, title, status, scheduled_start, started_at, ended_at)').eq('user_id', id).eq('role', 'speaker').limit(50),
  ])
  const pub = (tags ?? []).filter(t => t.tags?.status === 'official')
  const know = pub.filter(t => t.kind === 'knowledge')
  const intr = pub.filter(t => t.kind === 'interest')
  const shownCards = (cards ?? []).filter(c => c.tags?.status === 'official')
  const cardsByTag = new Map()
  for (const c of shownCards) cardsByTag.set(c.tag_id, (cardsByTag.get(c.tag_id) ?? 0) + 1)
  const lives = (parts ?? []).map(p => p.lives).filter(Boolean)
    .sort((a, b) => new Date(b.started_at ?? b.scheduled_start ?? 0) - new Date(a.started_at ?? a.scheduled_start ?? 0)).slice(0, 8)
  // 自分と共通のタグ（話しかけるきっかけ）
  const { data: mine } = await db.from('user_tags').select('tag_id, kind').eq('user_id', me.id)
  const myKnow = new Set((mine ?? []).filter(t => t.kind === 'knowledge').map(t => t.tag_id))
  const myIntr = new Set((mine ?? []).filter(t => t.kind === 'interest').map(t => t.tag_id))
  const canAsk = know.filter(t => myIntr.has(t.tag_id))      // 自分が興味を持っていて、この人が話せること
  const canTell = intr.filter(t => myKnow.has(t.tag_id))     // この人が興味を持っていて、自分が話せること

  return (
    <>
      <Topbar me={me} title={`${u.display_name}さんのプロフィール`} sub="公開している知見タグ・興味タグ" />
      <div className="body">
        <div className="card sh" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span className="avt" style={{ width: 64, height: 64, fontSize: 28 }}>{u.display_name.slice(0, 1)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexGrow: 1 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{u.display_name}</span>
            <span className="sub">{u.department}</span>
          </div>
          <Stat n={`知見 ${know.length}`} sub="話せること" />
          <Stat n={`興味 ${intr.length}`} sub="聞きたいこと" />
          <Stat n={`知見カード ${shownCards.length}`} sub="ライブの発言から生まれた" />
        </div>

        {(canAsk.length > 0 || canTell.length > 0) && (
          <div className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, borderColor: 'var(--shu)' }}>
            <b style={{ fontSize: 15 }}>🤝 あなたとのつながり</b>
            {canAsk.length > 0 && <Row label="この人に聞けそう" names={canAsk.map(t => t.tags.name)} bg="var(--blue-bg)" fg="var(--blue)" />}
            {canTell.length > 0 && <Row label="この人に話せそう" names={canTell.map(t => t.tags.name)} bg="var(--teal-bg)" fg="var(--teal)" />}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          <TagCol title="知見タグ" sub="話せること" tags={know} counts={cardsByTag} bg="var(--blue-bg)" fg="var(--blue)" />
          <TagCol title="興味タグ" sub="聞きたいこと" tags={intr} bg="var(--teal-bg)" fg="var(--teal)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
          <div className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b style={{ fontSize: 15 }}>知見カード</b>
            {shownCards.length === 0 && <span className="sub">まだありません</span>}
            {shownCards.slice(0, 10).map(c => (
              <Link key={c.id} href={`/cards?id=${c.id}`} className="topic hoverable" style={{ color: 'var(--ink)' }}>
                <span className="sub" style={{ fontSize: 11 }}>＃{c.tags.name} ・ {fmtWhen(c.created_at)}</span>
                <b style={{ fontSize: 14 }}>{c.headline}</b>
              </Link>
            ))}
          </div>
          <div className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b style={{ fontSize: 15 }}>話し手をしたライブ</b>
            {lives.length === 0 && <span className="sub">まだありません</span>}
            {lives.map(l => (
              <Link key={l.id} href={`/live/${l.id}`} className="topic hoverable" style={{ color: 'var(--ink)' }}>
                <span className="sub" style={{ fontSize: 11 }}>{l.status === 'live' ? '🔴 いま配信中' : l.status === 'scheduled' ? `予定 ${fmtWhen(l.scheduled_start)}` : fmtWhen(l.ended_at ?? l.started_at)}</span>
                <b style={{ fontSize: 14 }}>{splitTitle(l.title).main}</b>
              </Link>
            ))}
          </div>
        </div>
        <div className="note">非公開のタグと、まだ育ちかけのタグは表示されません</div>
      </div>
    </>
  )
}

function Stat({ n, sub }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140 }}>
      <b style={{ fontSize: 17 }}>{n}</b><span className="sub" style={{ fontSize: 11 }}>{sub}</span>
    </div>
  )
}
function Row({ label, names, bg, fg }) {
  return (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className="sub" style={{ width: 110, flexShrink: 0 }}>{label}</span>
      {names.map(n => <span key={n} className="chip" style={{ background: bg, color: fg }}>{n}</span>)}
    </span>
  )
}
function TagCol({ title, sub, tags, counts, bg, fg }) {
  return (
    <div className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span><b style={{ fontSize: 15 }}>{title}</b> <span className="sub">{sub}</span></span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tags.length === 0 && <span className="sub">公開しているタグはありません</span>}
        {tags.map(t => (
          <Link key={t.tag_id} href={`/cards?tag=${t.tag_id}`} className="chip" style={{ background: bg, color: fg, padding: '5px 10px', fontSize: 13 }}>
            <Icon name="tag" size={12} />{t.tags.name}{counts?.get(t.tag_id) ? <span style={{ opacity: .7, marginLeft: 4 }}>{counts.get(t.tag_id)}枚</span> : null}
          </Link>
        ))}
      </div>
    </div>
  )
}
