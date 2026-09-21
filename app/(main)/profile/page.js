import Link from 'next/link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen, splitTitle } from '@/lib/format'
import VisibilityToggle from './VisibilityToggle'

const SOURCE = { live: 'ライブから', self: '自己分析から', manual: '手で追加' }

// 自分のプロフィール。自分の user_tags は公開・非公開に関係なく本人に見える（RLS）
export default async function Profile({ searchParams }) {
  const sp = await searchParams
  const tab = ['knowledge', 'interest', 'lives'].includes(sp.tab) ? sp.tab : 'knowledge'
  const me = await currentUser()
  const db = await supabaseServer()

  const [{ data: mine }, { data: myParts }] = await Promise.all([
    db.from('user_tags').select('id, tag_id, kind, source, visibility, strength, updated_at, tags(name, status)')
      .eq('user_id', me.id).order('updated_at', { ascending: false }),
    db.from('live_participants').select('live_id, role, lives(id, title, status, scheduled_start, ended_at, started_at)').eq('user_id', me.id),
  ])
  const know = (mine ?? []).filter(t => t.kind === 'knowledge')
  const intr = (mine ?? []).filter(t => t.kind === 'interest')
  const lives = (myParts ?? []).filter(p => p.lives).sort((a, b) => b.live_id - a.live_id)
  const rows = tab === 'knowledge' ? know : intr

  return (
    <>
      <Topbar me={me} title="プロフィール" sub="あなたのタグは、公開にしたものだけが他の人に見えます" />
      <div className="body">
        <div className="card sh" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="avt" style={{ width: 56, height: 56, fontSize: 24 }}>{me.display_name.slice(0, 1)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexGrow: 1 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{me.display_name}</span>
            <span className="sub">{me.department}・{me.role === 'admin' ? '管理者' : '一般'}</span>
          </div>
          <Stat n={know.length} label="知見タグ" />
          <Stat n={intr.length} label="興味タグ" />
          <Stat n={lives.length} label="参加したライブ" />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <Link className={'tab' + (tab === 'knowledge' ? ' tabon' : '')} href="/profile?tab=knowledge">知見タグ（話せること）</Link>
          <Link className={'tab' + (tab === 'interest' ? ' tabon' : '')} href="/profile?tab=interest">興味タグ（聞きたいこと）</Link>
          <Link className={'tab' + (tab === 'lives' ? ' tabon' : '')} href="/profile?tab=lives">参加したライブ</Link>
        </div>

        {tab !== 'lives' && (
          <div className="card sh" style={{ padding: 12 }}>
            {rows.length === 0 ? <div className="empty">まだありません。ライブで話したり聞いたりすると、ここに育っていきます</div> : (
              <table>
                <thead><tr><th>タグ</th><th>どこから</th><th>更新</th><th>公開</th></tr></thead>
                <tbody>
                  {rows.map(t => (
                    <tr key={t.id}>
                      <td>
                        {t.tags?.status === 'official'
                          ? <span className="chip" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}><Icon name="tag" size={13} />{t.tags.name}</span>
                          : <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {t.tags?.name && <b>{t.tags.name}</b>}
                              <span className="chip" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>育ちかけ（管理者の承認待ち）</span>
                            </span>}
                      </td>
                      <td className="sub">{SOURCE[t.source] ?? t.source}</td>
                      <td className="sub">{fmtWhen(t.updated_at)}</td>
                      <td><VisibilityToggle tagId={t.tag_id} kind={t.kind} visibility={t.visibility} adopt={t.source === 'self' && t.visibility === 'private'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {tab !== 'lives' && <div className="note">育ちかけのタグは、公開にしても管理者が正式にするまで他の人には見えません。自己分析から付いたタグは最初は非公開です。「採用」すると公開になります</div>}

        {tab === 'lives' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lives.length === 0 && <div className="card empty">まだ参加したライブはありません</div>}
            {lives.map(p => (
              <Link key={p.live_id} href={`/live/${p.live_id}`} className="card sh" style={{ padding: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flexGrow: 1 }}>
                  <div style={{ fontWeight: 700 }}>＃{splitTitle(p.lives.title).main}</div>
                  <div className="sub">{p.role === 'speaker' ? 'スピーカー' : 'リスナー'} ・ {p.lives.status === 'scheduled' ? fmtWhen(p.lives.scheduled_start) + ' から' : fmtWhen(p.lives.ended_at ?? p.lives.started_at)}</div>
                </span>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function Stat({ n, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px' }}>
      <span className="kpi" style={{ fontSize: 26 }}>{n}</span>
      <span className="sub">{label}</span>
    </div>
  )
}
