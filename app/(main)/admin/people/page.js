import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'

// メンバーと権限。★ 権限の変更は画面からできない（users に update ポリシーを作らない設計。ルール1）
export default async function AdminPeople() {
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const [{ data: users }, { data: tags }, { data: invites }, { data: cards }] = await Promise.all([
    db.from('users').select('id, display_name, department, role').order('department'),
    db.from('user_tags').select('user_id, kind'),
    db.from('invitations').select('user_id, status, sent_at').gte('sent_at', since),
    db.from('knowledge_cards').select('speaker_id'),
  ])
  const count = (arr, f) => { const m = new Map(); for (const x of arr ?? []) { const k = f(x); m.set(k, (m.get(k) ?? 0) + 1) } return m }
  const know = count((tags ?? []).filter(t => t.kind === 'knowledge'), t => t.user_id)
  const intr = count((tags ?? []).filter(t => t.kind === 'interest'), t => t.user_id)
  const inv = count(invites, i => i.user_id)
  const acc = count((invites ?? []).filter(i => i.status === 'accepted'), i => i.user_id)
  const cc = count(cards, c => c.speaker_id)

  return (
    <>
      <Topbar me={me} title="メンバーと権限" sub="相談役の負担が1人に偏っていないかを見る" />
      <div className="body">
        <div className="note">権限の変更は画面からはできません（社員の行を書き換える口を作らない設計）。場づくりエージェントは同じ人への打診を1週間に2回までに抑えています</div>
        <div className="card sh" style={{ padding: 12 }}>
          <table>
            <thead><tr><th>名前</th><th>部署</th><th>権限</th><th>知見タグ</th><th>興味タグ</th><th>知見カード</th><th>打診（30日）</th><th>引き受け</th></tr></thead>
            <tbody>
              {(users ?? []).map(u => (
                <tr key={u.id}>
                  <td><b>{u.display_name}</b></td><td className="sub">{u.department}</td>
                  <td>{u.role === 'admin' ? '管理者' : '一般'} <button className="btn btn-s" disabled title="画面からは変えられません" style={{ marginLeft: 6, minHeight: 26, padding: '2px 8px' }}>変更</button></td>
                  <td className="num">{know.get(u.id) ?? 0}</td><td className="num">{intr.get(u.id) ?? 0}</td><td className="num">{cc.get(u.id) ?? 0}</td>
                  <td className="num" style={{ color: (inv.get(u.id) ?? 0) >= 3 ? 'var(--shu)' : undefined, fontWeight: (inv.get(u.id) ?? 0) >= 3 ? 700 : 400 }}>{inv.get(u.id) ?? 0}</td>
                  <td className="num">{acc.get(u.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
