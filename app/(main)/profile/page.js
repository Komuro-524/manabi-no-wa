import Link from '@/components/Link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'
import ClientTabs from '@/components/ClientTabs'
import TagBoard from './TagBoard'

const SOURCE = { live: 'ライブから', self: '自己分析から', manual: '手で追加' }
const TABS = [['tags', 'タグ'], ['knowledge', '知見タグの話題'], ['skill', '勝手に育つスキルシート'], ['lives', '参加したライブ']]

// 自分のプロフィール。自分の user_tags は公開・非公開に関係なく本人に見える（RLS）
// ★ モックの「閲覧回数」「スキルの点数」は元データが無いので出さない。数えられるもの（カード枚数・人数・回数）だけ
export default async function Profile({ searchParams }) {
  const sp = await searchParams
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab : 'tags'
  const me = await currentUser()
  const db = await supabaseServer()

  const [{ data: mine }, { data: myParts }, { data: myCards }, { count: segCount }, { data: invites }] = await Promise.all([
    db.from('user_tags').select('id, tag_id, kind, source, visibility, updated_at, tags(name, status, kind)')
      .eq('user_id', me.id).order('updated_at', { ascending: false }),
    db.from('live_participants').select('live_id, role, lives(id, title, status, scheduled_start, ended_at, started_at)').eq('user_id', me.id),
    db.from('knowledge_cards').select('id, live_id, tag_id, headline, created_at').eq('speaker_id', me.id).order('id', { ascending: false }),
    db.from('transcript_segments').select('seq', { count: 'exact', head: true }).eq('user_id', me.id),
    db.from('invitations').select('status'),   // RLS: 自分宛だけ
  ])
  const know = (mine ?? []).filter(t => t.kind === 'knowledge')
  const intr = (mine ?? []).filter(t => t.kind === 'interest')
  const lives = (myParts ?? []).filter(p => p.lives).sort((a, b) => b.live_id - a.live_id)
  const accepted = (invites ?? []).filter(i => i.status === 'accepted').length

  // 同じ知見を持つ人（自分以外で、読めた分＝公開かつ正式のもの）
  const tagIds = know.map(t => t.tag_id)
  const { data: others } = tagIds.length
    ? await db.from('user_tags').select('tag_id, user_id').in('tag_id', tagIds).eq('kind', 'knowledge').neq('user_id', me.id)
    : { data: [] }
  const peers = new Map()
  for (const o of others ?? []) { if (!peers.has(o.tag_id)) peers.set(o.tag_id, new Set()); peers.get(o.tag_id).add(o.user_id) }
  const allPeers = new Set((others ?? []).map(o => o.user_id))
  const cardsByTag = new Map()
  for (const c of myCards ?? []) { if (!cardsByTag.has(c.tag_id)) cardsByTag.set(c.tag_id, []); cardsByTag.get(c.tag_id).push(c) }
  const liveTitle = new Map(lives.map(p => [p.live_id, p.lives]))

  // スキルシート: 知見タグを分野/技術/業務でまとめ、カード枚数で伸ばす（点数は作らない）
  const skill = new Map()
  for (const t of know) {
    const k = t.tags?.status === 'official' ? (t.tags.kind ?? 'その他') : '育ちかけ'
    if (!skill.has(k)) skill.set(k, { tags: [], cards: 0 })
    const g = skill.get(k); g.tags.push(t.tags?.name ?? '（育ちかけ）'); g.cards += (cardsByTag.get(t.tag_id) ?? []).length
  }
  const maxCards = Math.max(1, ...[...skill.values()].map(g => g.cards))
  const lastUpdate = (mine ?? [])[0]?.updated_at

  return (
    <>
      <Topbar me={me} title="あなたのプロフィール" sub="知見タグ・興味タグ・スキルシート" />
      <div className="body">
        <div className="card sh" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span className="avt" style={{ width: 64, height: 64, fontSize: 28 }}>{me.display_name.slice(0, 1)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexGrow: 1 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{me.display_name}</span>
            <span className="sub">{me.department}・{me.role === 'admin' ? '管理者' : '一般'}</span>
            {lastUpdate && <span className="sub">最終更新：{fmtWhen(lastUpdate)}（タグ付けエージェントが自動で更新）</span>}
          </div>
          <Stat n={`知見 ${know.length}`} sub={`同じ知見を持つ人 ${allPeers.size}人`} />
          <Stat n={`興味 ${intr.length}`} sub={`ライブでの発言 ${segCount ?? 0}回（うち知見になった ${(myCards ?? []).length}）`} />
          <Stat n={`相談役 ${accepted}回`} sub={accepted >= 3 ? '最近多めです' : '負担は多くありません'} shu />
        </div>

        <ClientTabs basePath="/profile" initial={tab} tabs={TABS} panels={{
          tags: <TagBoard tags={(mine ?? []).map(t => ({ id: t.id, tag_id: t.tag_id, kind: t.kind, source: t.source, visibility: t.visibility, name: t.tags?.name ?? null, status: t.tags?.status ?? null, cards: t.kind === 'knowledge' ? (cardsByTag.get(t.tag_id) ?? []).length : 0 }))} />,
          knowledge: (know.length === 0
          ? <div className="card empty">まだありません。ライブで話すと、ここに育っていきます</div>
          : <div className="grid3">
              {know.map(t => {
                const cs = cardsByTag.get(t.tag_id) ?? []
                const official = t.tags?.status === 'official'
                return (
                  <div key={t.id} className="card sh" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {official
                        ? <Link href={`/cards?tag=${t.tag_id}`} style={{ fontSize: 17, fontWeight: 700, padding: '2px 0', color: 'var(--ink)' }} title="このタグの知見カードを見る">{t.tags.name}</Link>
                        : <h3 style={{ fontSize: 17, fontWeight: 700, padding: '2px 0' }}>{t.tags?.name ?? '（育ちかけ）'}</h3>}
                      {!official && <span className="chip" style={{ alignSelf: 'center', background: 'var(--amber-bg)', color: 'var(--amber)' }}>育ちかけ（管理者の承認待ち）</span>}
                      <span className="sub">同じ知見を持つ人 {peers.get(t.tag_id)?.size ?? 0}人 ・ 出典カード {cs.length}枚 ・ {SOURCE[t.source] ?? t.source}</span>
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
            </div>),
          skill: (
          <div className="card sh" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><div className="ttl">勝手に育つスキルシート</div>
              <span className="sub">ライブでの発言から生まれた知見カードの枚数で伸びます。現場が変わっても消えません（点数ではなく、実際に話した量です）</span></div>
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
              const cs = (myCards ?? []).filter(c => c.live_id === p.live_id)
              return (
                <div key={p.live_id} className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link href={`/live/${p.live_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)' }}>
                    <span style={{ flexGrow: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>＃{splitTitle(p.lives.title).main}</div>
                      <div className="sub">{p.lives.status === 'scheduled' ? fmtWhen(p.lives.scheduled_start) + ' 開催予定' : fmtWhen(p.lives.ended_at ?? p.lives.started_at) + ' 開催'} ・ あなたの知見カード {cs.length}枚</div>
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
