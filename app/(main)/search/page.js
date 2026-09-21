import Link from '@/components/Link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import { usersByIds } from '@/lib/users-by-id'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'

// 横断検索。右上の検索窓はどの画面からでもここに来る。
// Teams の検索のように、見つかったものを「種類ごとの段」で並べる（知見カード・ライブ・タグ・メンバー）。
// ★ 全部 本人のセッションで読む ＝ RLS がそのまま効く。見えてよいもの（正式タグ・公開タグなど）しか出ない
const PER = 5, MORE = 50
const KINDS = [['cards', '知見カード'], ['lives', 'ライブ'], ['tags', 'タグ'], ['people', 'メンバー']]

export default async function Search({ searchParams }) {
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const only = KINDS.some(([k]) => k === sp.only) ? sp.only : null
  const me = await currentUser()
  const db = await supabaseServer()
  const lim = k => (only === k ? MORE : PER) + 1          // 1件多く読んで「もっと見る」を出すか決める
  const pat = `%${q.replace(/[%_,()\\]/g, ' ').trim()}%`   // or() の区切り文字と ilike の記号は消す

  let cards = [], lives = [], tags = [], people = [], peopleTags = new Map(), tagPeople = []
  if (q) {
    const want = k => !only || only === k
    const [c, l, t, u] = await Promise.all([
      want('cards') ? db.from('knowledge_cards').select('id, headline, body, created_at, tags(name, status)')
        .or(`headline.ilike.${pat},body.ilike.${pat}`).order('id', { ascending: false }).limit(lim('cards')) : { data: [] },
      want('lives') ? db.from('lives').select('id, title, status, scheduled_start, started_at, ended_at, topic_tag_id')
        .ilike('title', pat).neq('status', 'cancelled').order('id', { ascending: false }).limit(lim('lives')) : { data: [] },
      (want('tags') || want('lives') || want('people')) ? db.from('tags').select('id, name').eq('status', 'official').ilike('name', pat).order('name').limit(MORE) : { data: [] },
      want('people') ? db.from('users').select('id, display_name, department')
        .or(`display_name.ilike.${pat},department.ilike.${pat}`).order('display_name').limit(lim('people')) : { data: [] },
    ])
    cards = c.data ?? []; tags = t.data ?? []; people = u.data ?? []
    lives = l.data ?? []
    const tagIds = tags.map(x => x.id)
    // ライブ: 題名に無くても、話題タグが当たったものも出す（予定のライブも含む）
    if (want('lives') && tagIds.length) {
      const { data: byTag } = await db.from('lives').select('id, title, status, scheduled_start, started_at, ended_at, topic_tag_id')
        .in('topic_tag_id', tagIds).neq('status', 'cancelled').order('id', { ascending: false }).limit(lim('lives'))
      const seen = new Set(lives.map(x => x.id))
      lives = [...lives, ...(byTag ?? []).filter(x => !seen.has(x.id))]
    }
    lives.sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.id - a.id)
    // メンバー: 名前が当たった人に加え、当たったタグを「公開で」持っている人も（RLS: 公開かつ正式だけ読める）
    if (want('people') && tagIds.length) {
      const { data: holders } = await db.from('user_tags').select('user_id, tag_id').in('tag_id', tagIds).limit(200)
      const tagName = new Map(tags.map(x => [x.id, x.name]))
      const byUser = new Map()
      for (const h of holders ?? []) { if (!byUser.has(h.user_id)) byUser.set(h.user_id, new Set()); byUser.get(h.user_id).add(tagName.get(h.tag_id)) }
      const known = new Set(people.map(p => p.id))
      const extra = await usersByIds(db, [...byUser.keys()].filter(id => !known.has(id)))
      tagPeople = [...extra.values()].map(u => ({ ...u, via: [...byUser.get(u.id)] }))
    }
    // 見つかった人ごとに、公開している知見タグ・興味タグを添える（正式タグだけ・RLSで公開分だけ）
    const pIds = [...people, ...tagPeople].map(p => p.id).slice(0, MORE + 1)
    if (pIds.length) {
      const { data: ut } = await db.from('user_tags').select('user_id, kind, tags(name, status)').in('user_id', pIds).limit(1000)
      for (const r of ut ?? []) {
        if (r.tags?.status !== 'official') continue
        if (!peopleTags.has(r.user_id)) peopleTags.set(r.user_id, { knowledge: [], interest: [] })
        peopleTags.get(r.user_id)[r.kind]?.push(r.tags.name)
      }
    }
  }
  const allPeople = [...people, ...tagPeople]
  const counts = { cards: cards.length, lives: lives.length, tags: tags.length, people: allPeople.length }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const cap = k => (only === k ? MORE : PER)
  const link = extra => '/search?' + new URLSearchParams({ q, ...extra }).toString()

  return (
    <>
      <Topbar me={me} title="さがす" sub={q ? `「${q}」の結果` : 'タグ・人・知見カード・ライブをまとめて探せます'} />
      <div className="body" style={{ gap: 18 }}>
        <form action="/search" style={{ display: 'flex', gap: 6 }}>
          <input className="inp" name="q" defaultValue={q} autoFocus={!q} placeholder="タグ・人・知見カード・ライブを探す" aria-label="さがす" style={{ maxWidth: 480, minHeight: 44, fontSize: 15 }} />
          <button className="btn btn-p" style={{ minHeight: 44 }}><Icon name="search" size={16} /> さがす</button>
        </form>
        {q && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Link className={'tab' + (!only ? ' tabon' : '')} href={link({})}>すべて</Link>
            {KINDS.map(([k, name]) => <Link key={k} className={'tab' + (only === k ? ' tabon' : '')} href={link({ only: k })}>{name}</Link>)}
          </div>
        )}
        {q && total === 0 && <div className="card empty">「{q}」に当てはまるものは見つかりませんでした</div>}

        {counts.people > 0 && (
          <Section title="メンバー" n={counts.people} cap={cap('people')} more={!only && counts.people > PER ? link({ only: 'people' }) : null}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {allPeople.slice(0, cap('people')).map(p => {
                const t = peopleTags.get(p.id) ?? { knowledge: [], interest: [] }
                return (
                  <div key={p.id} className="card sh" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className="avt" style={{ width: 34, height: 34, fontSize: 15 }}>{p.display_name.slice(0, 1)}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <b>{p.display_name}{p.id === me.id ? '（あなた）' : ''}</b>
                        <span className="sub">{p.department ?? ''}{p.via ? ` ・ ＃${p.via.join('・＃')} を持っている` : ''}</span>
                      </span>
                    </span>
                    <TagRow label="話せること" names={t.knowledge} bg="var(--blue-bg)" fg="var(--blue)" />
                    <TagRow label="聞きたいこと" names={t.interest} bg="var(--teal-bg)" fg="var(--teal)" />
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {counts.tags > 0 && (!only || only === 'tags') && (
          <Section title="タグ" n={counts.tags} cap={cap('tags')} more={!only && counts.tags > PER ? link({ only: 'tags' }) : null}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tags.slice(0, cap('tags')).map(t => (
                <span key={t.id} className="card" style={{ padding: '6px 8px 6px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <b>＃{t.name}</b>
                  <Link className="btn btn-s" href={`/cards?tag=${t.id}`}>カード</Link>
                  <Link className="btn btn-s" href={`/map?q=${encodeURIComponent(t.name)}`}>地図</Link>
                </span>
              ))}
            </div>
          </Section>
        )}

        {counts.lives > 0 && (
          <Section title="ライブ" n={counts.lives} cap={cap('lives')} more={!only && counts.lives > PER ? link({ only: 'lives' }) : null}>
            <div className="card sh" style={{ padding: '4px 14px' }}>
              {lives.slice(0, cap('lives')).map(l => {
                const tt = splitTitle(l.title)
                return (
                  <Link key={l.id} href={`/live/${l.id}`} className="hoverable" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 6px', borderTop: '1px solid var(--line-soft)', color: 'var(--ink)', borderRadius: 6 }}>
                    <span className="chip" style={LIVE_CHIP[l.status]}>{LIVE_NAME[l.status]}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
                      <b style={{ overflowWrap: 'anywhere' }}>{tt.main}</b>
                      <span className="sub">{tt.sub ? `${tt.sub} ・ ` : ''}{fmtWhen(l.started_at ?? l.scheduled_start)}</span>
                    </span>
                    <span className="sub" aria-hidden="true">›</span>
                  </Link>
                )
              })}
            </div>
          </Section>
        )}

        {counts.cards > 0 && (
          <Section title="知見カード" n={counts.cards} cap={cap('cards')} more={!only && counts.cards > PER ? link({ only: 'cards' }) : `/cards?q=${encodeURIComponent(q)}`} moreLabel={!only && counts.cards > PER ? null : '知見カードの画面で見る'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cards.slice(0, cap('cards')).map(c => (
                <Link key={c.id} href={`/cards?q=${encodeURIComponent(q)}&id=${c.id}`} className="card sh hoverable" style={{ padding: 12, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="sub">{c.tags?.status === 'official' ? `＃${c.tags.name}` : '育ちかけのタグ'} ・ {fmtWhen(c.created_at)}</span>
                  <b style={{ fontSize: 15 }}>{c.headline}</b>
                  <span className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</span>
                </Link>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  )
}

const ORDER = { live: 0, scheduled: 1, ended: 2, cancelled: 3 }
const LIVE_NAME = { live: '配信中', scheduled: '予定', ended: '終了', cancelled: '中止' }
const LIVE_CHIP = {
  live: { background: 'var(--live)', color: '#FFFFFF' },
  scheduled: { background: 'var(--amber-bg)', color: 'var(--amber)' },
  ended: { background: 'var(--sand)', color: 'var(--ink2)' },
  cancelled: { background: 'var(--sand)', color: 'var(--sub)' },
}

function Section({ title, n, cap, more, moreLabel, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="sec" style={{ fontSize: 18, paddingTop: 0 }}>{title}</span>
        <span className="sub">{n > cap ? `${cap}件以上` : `${n}件`}</span>
        <span style={{ flexGrow: 1 }} />
        {more && <Link className="btn btn-s" href={more}>{moreLabel ?? 'もっと見る'}</Link>}
      </div>
      {children}
    </section>
  )
}

function TagRow({ label, names, bg, fg }) {
  return (
    <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className="sub" style={{ fontSize: 11, width: 64, flexShrink: 0 }}>{label}</span>
      {names.length ? names.slice(0, 6).map(n => <span key={n} className="chip" style={{ background: bg, color: fg }}>{n}</span>)
        : <span className="sub" style={{ fontSize: 11 }}>公開しているタグはありません</span>}
    </span>
  )
}
