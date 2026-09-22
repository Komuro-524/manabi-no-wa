import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import Link from '@/components/Link'
import BurdenChart from './BurdenChart'

const PER = 50

// メンバーと権限。★ 権限の変更は画面からできない（users に update ポリシーを作らない設計。ルール1）
export default async function AdminPeople({ searchParams }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page) || 1)
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  // ★ 数千人になっても読めるよう、1ページ50人ずつ。数えるのもそのページの人の分だけ
  const { data: users, count: total } = await db.from('users').select('id, display_name, department, role', { count: 'exact' })
    .order('department').order('display_name').range((page - 1) * PER, page * PER - 1)
  const ids = (users ?? []).map(u => u.id)
  const [{ data: invites }, { data: cards }] = ids.length ? await Promise.all([
    db.from('invitations').select('user_id, status, sent_at').in('user_id', ids).gte('sent_at', since),
    db.from('knowledge_cards').select('speaker_id').in('speaker_id', ids),
  ]) : [{ data: [] }, { data: [] }]
  const pages = Math.max(1, Math.ceil((total ?? 0) / PER))
  const count = (arr, f) => { const m = new Map(); for (const x of arr ?? []) { const k = f(x); m.set(k, (m.get(k) ?? 0) + 1) } return m }
  const inv = count(invites, i => i.user_id)
  const acc = count((invites ?? []).filter(i => i.status === 'accepted'), i => i.user_id)
  const cc = count(cards, c => c.speaker_id)

  return (
    <>
      <Topbar me={me} title="メンバー" sub="話し手の負担が1人に偏っていないか" />
      <div className="body" style={{ overflow: 'hidden' }}>
        <BurdenChart rows={(users ?? []).map(u => ({ id: u.id, name: u.display_name, cards: cc.get(u.id) ?? 0, invites: inv.get(u.id) ?? 0 }))} />
        <div className="note">権限は画面からは変えられません。{pages > 1 ? 'グラフはこのページの50人分です' : ''}</div>
        <div className="card sh" style={{ padding: 12, flexGrow: 1, minHeight: 160, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>名前</th><th>部署</th><th>権限</th><th>知見カード</th><th>話し手の相談（30日）</th></tr></thead>
            <tbody>
              {(users ?? []).map(u => (
                <tr key={u.id}>
                  <td><b>{u.display_name}</b></td><td className="sub">{u.department}</td>
                  <td>{u.role === 'admin' ? '管理者' : '一般'}</td>
                  <td className="num">{cc.get(u.id) ?? 0}</td>
                  <td className="num" style={{ color: (inv.get(u.id) ?? 0) >= 3 ? 'var(--shu)' : undefined, fontWeight: (inv.get(u.id) ?? 0) >= 3 ? 700 : 400 }}>{inv.get(u.id) ?? 0}回{(acc.get(u.id) ?? 0) > 0 ? `（引き受け${acc.get(u.id)}）` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            {page > 1 ? <Link className="btn btn-s" href={`/admin/people?page=${page - 1}`}>前の50人</Link> : <span />}
            <span className="sub">{page} / {pages} ページ（全{total}人）</span>
            {page < pages ? <Link className="btn btn-s" href={`/admin/people?page=${page + 1}`}>次の50人</Link> : <span />}
          </div>
        )}
      </div>
    </>
  )
}
