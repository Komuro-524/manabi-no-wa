import { supabaseServer, currentUser } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen } from '@/lib/format'
import InviteButtons from './InviteButtons'

// AIからの打診。打診そのものは RLS（自分宛だけ）で読む。
// 打診の理由とタグ名は quests / quest_steps にあり、ブラウザからは読めない設計（ポリシー無し）なので、
// ★ サーバー側で「本人宛の打診に紐づく企て」だけに絞って service_role で読む
export default async function InvitePage() {
  const me = await currentUser()
  const db = await supabaseServer()
  const { data: invites } = await db.from('invitations')
    .select('id, quest_id, status, sent_at, responded_at').order('id', { ascending: false })

  const questIds = [...new Set((invites ?? []).map(i => i.quest_id))]
  const info = new Map()
  if (questIds.length) {
    const admin = supabaseAdmin()
    const [{ data: quests }, { data: steps }] = await Promise.all([
      admin.from('quests').select('id, tag_id, tags(name)').in('id', questIds),
      admin.from('quest_steps').select('quest_id, reason, created_at').in('quest_id', questIds).eq('kind', 'invite').order('id'),
    ])
    for (const q of quests ?? []) info.set(q.id, { tag: q.tags?.name ?? '?', reason: '' })
    for (const s of steps ?? []) {
      // 「○○ に打診した。<理由>」の形。本人向けには理由の部分だけ出す
      const m = s.reason.match(/に打診した。(.*)$/s)
      if (m && info.has(s.quest_id)) info.get(s.quest_id).reason = m[1].trim()
    }
  }
  const open = (invites ?? []).filter(i => i.status === 'sent')
  const done = (invites ?? []).filter(i => i.status !== 'sent')

  return (
    <>
      <Topbar me={me} title="AIからの打診" sub={`返事待ち ${open.length}件`} />
      <div className="body">
        <div className="note">場づくりエージェントが「この話、あなたに聞きたい人がいます」とお願いしています。引き受けると、あなたの予定の空き（埋まっているかどうかだけ）を見て日程を決めます。断っても大丈夫です。</div>
        <span className="sec">返事待ち</span>
        {open.length === 0 && <div className="card empty">いま届いている打診はありません</div>}
        {open.map(i => (
          <div key={i.id} className="card sh" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <span className="chip" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}><Icon name="tag" size={13} />{info.get(i.quest_id)?.tag}</span>
              <span className="sub">{fmtWhen(i.sent_at)} に届きました</span>
            </span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>「{info.get(i.quest_id)?.tag}」の回で、話し手をお願いできませんか？</span>
            {info.get(i.quest_id)?.reason && (
              <div style={{ display: 'flex', gap: 10, background: 'var(--amber-bg)', borderRadius: 10, padding: '10px 12px' }}>
                <span style={{ color: 'var(--amber)' }}><Icon name="robot" /></span>
                <span style={{ fontSize: 13, lineHeight: 1.6 }}><b>あなたにお願いした理由：</b>{info.get(i.quest_id).reason}</span>
              </div>
            )}
            <InviteButtons id={i.id} />
          </div>
        ))}
        {done.length > 0 && <>
          <span className="sec">これまでの打診</span>
          <div className="card sh" style={{ padding: 12 }}>
            <table><thead><tr><th>タグ</th><th>届いた日</th><th>返事</th></tr></thead><tbody>
              {done.map(i => (
                <tr key={i.id}><td>{info.get(i.quest_id)?.tag}</td><td>{fmtWhen(i.sent_at)}</td>
                  <td>{i.status === 'accepted' ? '引き受けた' : i.status === 'declined' ? '見送った' : '期限切れ'}</td></tr>
              ))}
            </tbody></table>
          </div>
        </>}
      </div>
    </>
  )
}
