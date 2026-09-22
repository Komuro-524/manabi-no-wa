import Link from '@/components/Link'
import { notFound, redirect } from 'next/navigation'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import ClientTabs from '@/components/ClientTabs'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'

// 他の人のプロフィール（アイコンや検索結果から来る）。見た目は自分のプロフィール（/profile）とそろえる。
// ★ 本人が「公開」にした 正式タグ だけを出す。非公開・育ちかけは、管理者が見ても ここには出さない（本人の意思を優先）
// ★ 全部 見ている人のセッションで読む ＝ RLS がそのまま効く
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TABS = [['knowledge', '知見タグ'], ['interest', '興味タグ'], ['skill', '勝手に育つスキルシート'], ['lives', '参加したライブ']]

export default async function PersonPage({ params, searchParams }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const sp = await searchParams
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab : 'knowledge'
  const me = await currentUser()
  if (id === me.id) redirect('/profile')
  const db = await supabaseServer()

  const { data: u } = await db.from('users').select('id, display_name, department').eq('id', id).maybeSingle()
  if (!u) notFound()
  const [{ data: tags }, { data: cards }, { data: parts }, { data: mine }] = await Promise.all([
    db.from('user_tags').select('tag_id, kind, updated_at, tags(name, status, kind)').eq('user_id', id).eq('visibility', 'public').order('updated_at', { ascending: false }),
    db.from('knowledge_cards').select('id, live_id, headline, created_at, tag_id, tags(name, status)').eq('speaker_id', id).order('id', { ascending: false }).limit(200),
    db.from('live_participants').select('live_id, role, lives(id, title, status, scheduled_start, started_at, ended_at)').eq('user_id', id).limit(100),
    db.from('user_tags').select('tag_id, kind').eq('user_id', me.id),
  ])
  const pub = (tags ?? []).filter(t => t.tags?.status === 'official')
  const know = pub.filter(t => t.kind === 'knowledge')
  const intr = pub.filter(t => t.kind === 'interest')
  const shownCards = (cards ?? []).filter(c => c.tags?.status === 'official')
  const cardsByTag = new Map()
  for (const c of shownCards) { if (!cardsByTag.has(c.tag_id)) cardsByTag.set(c.tag_id, []); cardsByTag.get(c.tag_id).push(c) }
  const lives = (parts ?? []).filter(p => p.lives)
    .sort((a, b) => new Date(b.lives.started_at ?? b.lives.scheduled_start ?? 0) - new Date(a.lives.started_at ?? a.lives.scheduled_start ?? 0))

  // 同じ知見を持つ人（この人以外で、読めた分＝公開かつ正式のもの）
  const tagIds = know.map(t => t.tag_id)
  const { data: others } = tagIds.length
    ? await db.from('user_tags').select('tag_id, user_id').in('tag_id', tagIds).eq('kind', 'knowledge').neq('user_id', id)
    : { data: [] }
  const peers = new Map()
  for (const o of others ?? []) { if (!peers.has(o.tag_id)) peers.set(o.tag_id, new Set()); peers.get(o.tag_id).add(o.user_id) }

  // あなたとのつながり（話しかけるきっかけ）
  const myKnow = new Set((mine ?? []).filter(t => t.kind === 'knowledge').map(t => t.tag_id))
  const myIntr = new Set((mine ?? []).filter(t => t.kind === 'interest').map(t => t.tag_id))
  const canAsk = know.filter(t => myIntr.has(t.tag_id))      // 自分が興味を持っていて、この人が話せること
  const canTell = intr.filter(t => myKnow.has(t.tag_id))     // この人が興味を持っていて、自分が話せること

  // スキルシート（自分のプロフィールと同じ作り。公開・正式の知見タグだけで）
  const skill = new Map()
  for (const t of know) {
    const k = t.tags.kind ?? 'その他'
    if (!skill.has(k)) skill.set(k, { tags: [], cards: 0 })
    const g = skill.get(k); g.tags.push(t.tags.name); g.cards += (cardsByTag.get(t.tag_id) ?? []).length
  }
  const maxCards = Math.max(1, ...[...skill.values()].map(g => g.cards))
  const speakerCount = lives.filter(p => p.role === 'speaker').length

  return (
    <>
      <Topbar me={me} title={`${u.display_name}さんのプロフィール`} sub="公開している知見タグ・興味タグ・スキルシート" />
      <div className="body">
        <div className="card sh" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span className="avt" style={{ width: 64, height: 64, fontSize: 28 }}>{u.display_name.slice(0, 1)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexGrow: 1 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{u.display_name}</span>
            <span className="sub">{u.department}</span>
            {pub[0]?.updated_at && <span className="sub">最終更新：{fmtWhen(pub[0].updated_at)}（タグ付けエージェントが自動で更新）</span>}
          </div>
          <Stat n={`知見 ${know.length}`} sub={`知見カード ${shownCards.length}枚`} />
          <Stat n={`興味 ${intr.length}`} sub="聞きたいこと" />
          <Stat n={`話し手 ${speakerCount}回`} sub={`参加したライブ ${lives.length}回`} shu />
        </div>

        {(canAsk.length > 0 || canTell.length > 0) && (
          <div className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, borderColor: 'var(--shu)' }}>
            <b style={{ fontSize: 15 }}>🤝 あなたとのつながり</b>
            {canAsk.length > 0 && <Row label="この人に聞けそう" names={canAsk.map(t => t.tags.name)} bg="var(--blue-bg)" fg="var(--blue)" />}
            {canTell.length > 0 && <Row label="この人に話せそう" names={canTell.map(t => t.tags.name)} bg="var(--teal-bg)" fg="var(--teal)" />}
          </div>
        )}

        <ClientTabs basePath={`/people/${id}`} initial={tab} tabs={TABS} panels={{
          knowledge: <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TagShelf title="知見タグ" sub="話せること" tags={know} counts={cardsByTag} bg="var(--blue-bg)" fg="var(--blue)" />
            <b style={{ fontSize: 15, paddingTop: 4 }}>知見タグごとの話題</b>
            {know.length === 0
              ? <div className="card empty">公開している知見タグはまだありません</div>
              : <div className="grid3">
                  {know.map(t => {
                    const cs = cardsByTag.get(t.tag_id) ?? []
                    return (
                      <div key={t.tag_id} className="card sh" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Link href={`/cards?tag=${t.tag_id}`} style={{ fontSize: 17, fontWeight: 700, padding: '2px 0', color: 'var(--ink)' }} title="このタグの知見カードを見る">{t.tags.name}</Link>
                          <span className="sub">同じ知見を持つ人 {peers.get(t.tag_id)?.size ?? 0}人 ・ 出典カード {cs.length}枚</span>
                        </div>
                        {cs.length > 0 && <>
                          <span className="sub" style={{ fontWeight: 700 }}>話題（{cs.length}件）</span>
                          {cs.slice(0, 3).map(c => (
                            <Link key={c.id} href={`/cards?id=${c.id}`} className="topic" style={{ color: 'var(--ink)' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>{c.headline}</span>
                              <span className="sub" style={{ fontSize: 10 }}>{fmtWhen(c.created_at)} のライブ</span>
                            </Link>
                          ))}
                        </>}
                      </div>
                    )
                  })}
                </div>}
          </div>,
          interest: <TagShelf title="興味タグ" sub="聞きたいこと" tags={intr} bg="var(--teal-bg)" fg="var(--teal)" />,
          skill: (
            <div className="card sh" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><div className="ttl">勝手に育つスキルシート</div>
                <span className="sub">ライブでの発言から生まれた知見カードの枚数で伸びます（公開している正式な知見タグの分だけ）</span></div>
              {skill.size === 0 && <div className="empty">まだありません</div>}
              {[...skill].map(([k, g]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}><b>{k}</b><span className="sub num">カード {g.cards}枚 ・ タグ {g.tags.length}個</span></span>
                  <div style={{ height: 10, borderRadius: 999, background: 'var(--bar)', overflow: 'hidden' }}><div style={{ width: `${Math.max(4, g.cards / maxCards * 100)}%`, height: '100%', background: 'var(--ai-on)' }} /></div>
                  <span className="sub">{g.tags.join('・')}</span>
                </div>
              ))}
            </div>
          ),
          lives: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lives.length === 0 && <div className="card empty">まだ参加したライブはありません</div>}
              {lives.map(p => {
                const cs = shownCards.filter(c => c.live_id === p.live_id)
                return (
                  <div key={p.live_id} className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link href={`/live/${p.live_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)' }}>
                      <span style={{ flexGrow: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 17 }}>＃{splitTitle(p.lives.title).main}</div>
                        <div className="sub">{p.lives.status === 'live' ? '🔴 いま配信中' : p.lives.status === 'scheduled' ? fmtWhen(p.lives.scheduled_start) + ' 開催予定' : fmtWhen(p.lives.ended_at ?? p.lives.started_at) + ' 開催'} ・ 知見カード {cs.length}枚</div>
                      </span>
                      <span className="chip" style={{ background: p.role === 'speaker' ? 'var(--shu-bg)' : 'var(--sand)', color: p.role === 'speaker' ? 'var(--shu)' : 'var(--ink2)' }}>{p.role === 'speaker' ? 'スピーカー' : 'リスナー'}</span>
                    </Link>
                    {cs.map(c => <Link key={c.id} href={`/cards?id=${c.id}`} className="topic" style={{ color: 'var(--ink)' }}><span style={{ fontWeight: 700 }}>{c.headline}</span></Link>)}
                  </div>
                )
              })}
            </div>
          ),
        }} />
        <div className="note">非公開のタグと、まだ育ちかけのタグは表示されません</div>
      </div>
    </>
  )
}

function Stat({ n, sub, shu }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 14px', borderRadius: 12, background: shu ? 'var(--shu-bg)' : 'var(--bg)', minWidth: 150 }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: shu ? 'var(--shu)' : 'var(--ink)' }}>{n}</span>
      <span className="sub" style={{ fontSize: 10, color: shu ? 'var(--shu)' : undefined }}>{sub}</span>
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
// 自分のプロフィールの「公開」エリアと同じ見た目（読むだけ。ドラッグはできない）
function TagShelf({ title, sub, tags, counts, bg, fg }) {
  return (
    <div className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><b style={{ fontSize: 16 }}>{title}</b><span className="sub">{sub}</span></div>
      <div style={{ minHeight: 60, borderRadius: 12, padding: 10, background: 'var(--teal-bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>公開<span className="sub" style={{ fontWeight: 400 }}>（みんなに見える）</span></span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.length === 0 && <span className="sub" style={{ fontSize: 11 }}>公開しているタグはありません</span>}
          {tags.map(t => (
            <Link key={t.tag_id} href={`/cards?tag=${t.tag_id}`} className="card hoverable" title="このタグの知見カードを見る"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, background: '#FFF', color: 'var(--ink)' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t.tags.name}</span>
              {counts?.get(t.tag_id)?.length ? <span className="sub" style={{ fontSize: 10 }}>{counts.get(t.tag_id).length}枚</span> : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
