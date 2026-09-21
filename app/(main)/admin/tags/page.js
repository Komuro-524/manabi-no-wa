import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import { fmtWhen } from '@/lib/format'
import TagActions from './TagActions'

const TABS = [['all', 'すべて'], ['proposed', '格上げ候補'], ['candidate', '候補'], ['official', '正式'], ['rejected', '弾いた語'], ['banned', '禁止']]
const NAME = Object.fromEntries(TABS)

// タグ辞書。タグそのものは管理者本人のセッションで読む（RLS: 正式以外は管理者だけ）
export default async function AdminTags({ searchParams }) {
  const sp = await searchParams
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab : 'proposed'
  const me = await requireAdmin()
  const db = await supabaseServer()

  const { data: all } = await db.from('tags')
    .select('id, name, kind, status, proposed_at, promoted_at, reviewed_at, rejected_reason, created_at').order('id', { ascending: false })
  const rows = tab === 'all' ? (all ?? []) : (all ?? []).filter(t => t.status === tab)

  // 何回・何人が語ったか。tag_mentions はブラウザから読めない設計 → 管理者と確かめたので service_role で数える
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: ments } = await supabaseAdmin().from('tag_mentions')
    .select('tag_id, user_id, live_id, created_at').in('tag_id', rows.map(r => r.id).concat(-1))
  const stat = new Map()
  for (const m of ments ?? []) {
    if (!stat.has(m.tag_id)) stat.set(m.tag_id, { lives: new Set(), users: new Set(), recentLives: new Set(), recentUsers: new Set() })
    const s = stat.get(m.tag_id)
    s.lives.add(m.live_id); s.users.add(m.user_id)
    if (m.created_at >= since) { s.recentLives.add(m.live_id); s.recentUsers.add(m.user_id) }
  }

  return (
    <>
      <Topbar me={me} title="タグ辞書" sub="AIが見つけた言葉は候補止まり。正式にするのは管理者だけ" />
      <div className="body" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(([k, name]) => (
            <Link key={k} href={`/admin/tags?tab=${k}`} className={'tab' + (tab === k ? ' tabon' : '')}>
              {name}<span className="num" style={{ opacity: .7 }}>{k === 'all' ? (all ?? []).length : (all ?? []).filter(t => t.status === k).length}</span>
            </Link>
          ))}
        </div>
        {tab === 'proposed' && <div className="note">直近30日に「3つのライブ」または「2人以上」が語った言葉です。正式にすると全員に見えるようになります</div>}
        <div className="card sh" style={{ padding: 12, flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
          {rows.length === 0 ? <div className="empty">ありません</div> : (
            <table>
              <thead><tr><th>タグ</th>{tab === 'all' && <th>状態</th>}<th>語られた（30日）</th><th></th></tr></thead>
              <tbody>
                {rows.map(t => {
                  const s = stat.get(t.id)
                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700 }}>{t.name}</td>
                      {tab === 'all' && <td className="sub">{NAME[t.status]}</td>}
                      <td className="num">{s ? `${s.recentLives.size}回・${s.recentUsers.size}人` : '—'}</td>
                      <td><TagActions id={t.id} status={t.status} meId={me.id} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
