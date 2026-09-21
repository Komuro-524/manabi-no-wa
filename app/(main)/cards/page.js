import Link from 'next/link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'

// 知見カード。全部 本人のセッションで読む（RLS: 正式タグのカードは全員、育ちかけは話した本人と管理者だけ）
export default async function Cards({ searchParams }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const tagId = sp.tag ? Number(sp.tag) : null
  const selId = sp.id ? Number(sp.id) : null
  const me = await currentUser()
  const db = await supabaseServer()

  let query = db.from('knowledge_cards')
    .select('id, live_id, tag_id, speaker_id, headline, body, created_at, tags(name, status)')
    .order('id', { ascending: false }).limit(60)
  if (q) query = query.or(`headline.ilike.%${q.replace(/[%,()]/g, '')}%,body.ilike.%${q.replace(/[%,()]/g, '')}%`)
  if (tagId) query = query.eq('tag_id', tagId)

  const [{ data: cards }, { data: users }, { data: officialTags }] = await Promise.all([
    query,
    db.from('users').select('id, display_name, department'),
    db.from('tags').select('id, name').eq('status', 'official').order('name'),
  ])
  const who = new Map((users ?? []).map(u => [u.id, u]))
  const sel = (cards ?? []).find(c => c.id === selId) ?? (cards ?? [])[0]

  // 選んだカードの詳細（詳しい人・元の発言・元のライブ）
  let experts = [], quotes = null, live = null
  if (sel) {
    const [{ data: ut }, { data: segs }, { data: lv }] = await Promise.all([
      db.from('user_tags').select('user_id, kind').eq('tag_id', sel.tag_id).eq('kind', 'knowledge'),   // RLS: 公開かつ正式 or 本人 or 管理者
      db.from('transcript_segments').select('seq, body').eq('live_id', sel.live_id).eq('user_id', sel.speaker_id).order('seq').limit(3), // RLS: 参加者だけ
      db.from('lives').select('id, title, ended_at, started_at').eq('id', sel.live_id).maybeSingle(),
    ])
    experts = [...new Set((ut ?? []).map(r => r.user_id))].map(id => who.get(id)).filter(Boolean)
    quotes = segs ?? []
    live = lv
  }
  const qs = (extra) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q); if (tagId) p.set('tag', tagId)
    for (const [k, v] of Object.entries(extra)) v == null ? p.delete(k) : p.set(k, v)
    return '/cards?' + p.toString()
  }

  return (
    <>
      <Topbar me={me} title="知見カード" sub={`${(cards ?? []).length}件${q ? `（「${q}」で検索）` : ''}`}>
        <form action="/cards" style={{ display: 'flex', gap: 6 }}>
          {tagId && <input type="hidden" name="tag" value={tagId} />}
          <input className="inp" name="q" defaultValue={q} placeholder="見出し・本文を探す" style={{ width: 240, minHeight: 40 }} />
          <button className="btn btn-s" style={{ minHeight: 40 }}><Icon name="search" size={15} /></button>
        </form>
      </Topbar>
      <div className="body">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link className={'tab' + (!tagId ? ' tabon' : '')} href={qs({ tag: null, id: null })}>すべて</Link>
          {(officialTags ?? []).map(t => (
            <Link key={t.id} className={'tab' + (tagId === t.id ? ' tabon' : '')} href={qs({ tag: t.id, id: null })}>{t.name}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* 左: 一覧 */}
          <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(cards ?? []).length === 0 && <div className="card empty">見つかりませんでした</div>}
            {(cards ?? []).map(c => (
              <Link key={c.id} href={qs({ id: c.id })} className="card sh"
                style={{ padding: 14, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 5, borderColor: sel?.id === c.id ? 'var(--ai)' : undefined }}>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <TagChip t={c.tags} />
                  <span className="sub">{who.get(c.speaker_id)?.display_name ?? '?'} ・ {fmtWhen(c.created_at)}</span>
                </span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{c.headline}</span>
                <span className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</span>
              </Link>
            ))}
          </div>
          {/* 右: 詳細 */}
          {sel && (
            <div className="card sh" style={{ width: 400, flexShrink: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 0 }}>
              <TagChip t={sel.tags} />
              <div style={{ fontSize: 20, fontWeight: 700 }}>{sel.headline}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>{sel.body}</div>
              <div className="sub">話した人: {who.get(sel.speaker_id)?.display_name ?? '?'}（{who.get(sel.speaker_id)?.department}）</div>
              {live && <Link className="btn btn-s" style={{ alignSelf: 'flex-start' }} href={`/live/${live.id}`}><Icon name="live" size={14} /> 元のライブ：{splitTitle(live.title).main}</Link>}

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="ttl" style={{ fontSize: 15 }}>このカードの元になった発言</span>
                {quotes && quotes.length > 0
                  ? quotes.map(s => <div key={s.seq} className="sub" style={{ borderLeft: '3px solid var(--line)', paddingLeft: 8 }}>{s.body}</div>)
                  : <div className="note">元の発言は、そのライブに参加した人だけが読めます</div>}
              </div>
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="ttl" style={{ fontSize: 15 }}>この知見に詳しい人</span>
                {experts.length
                  ? experts.map(u => <span key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><span className="avt" style={{ width: 26, height: 26, fontSize: 12 }}>{u.display_name.slice(0, 1)}</span>{u.display_name}<span className="sub">{u.department}</span></span>)
                  : <span className="sub">公開している人はまだいません</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function TagChip({ t }) {
  return t?.name
    ? <span className="chip" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', alignSelf: 'flex-start' }}><Icon name="tag" size={13} />{t.name}</span>
    : <span className="chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', alignSelf: 'flex-start' }}>育ちかけのタグ</span>
}
