import { supabaseServer, currentUser } from '@/lib/supabase/server'
import { usersByIds } from '@/lib/users-by-id'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import { Icon } from '@/components/icons'
import { fmtWhen } from '@/lib/format'
import InviteButtons from './InviteButtons'

// AIからの打診。打診そのものは RLS（自分宛だけ）で読む。
// 企て（quests / quest_steps / tag_mentions）はブラウザから読めない設計なので、
// ★ サーバー側で「本人宛の打診に紐づく企て」と「本人の分」だけに絞って service_role で読む。
//   興味を持っている人は、名前を出さず人数と部署だけ（非公開の興味タグから集まった人もいるため）
export default async function InvitePage() {
  const me = await currentUser()
  const db = await supabaseServer()
  const { data: invites } = await db.from('invitations')
    .select('id, quest_id, status, sent_at, responded_at').order('id', { ascending: false })

  const questIds = [...new Set((invites ?? []).map(i => i.quest_id))]
  const info = new Map()
  if (questIds.length) {
    const admin = supabaseAdmin()
    // ★ エージェントの判断メモ（quest_steps）は管理者向けの言葉なので、本人の画面には出さない。理由は数えた事実3つで示す
    const { data: quests } = await admin.from('quests').select('id, tag_id, interested_ids, live_id, tags(name)').in('id', questIds)
    const users = await usersByIds(admin, (quests ?? []).flatMap(q => q.interested_ids ?? []), 'id, department')
    const dept = new Map([...users.values()].map(u => [u.id, u.department]))
    const tagIds = (quests ?? []).map(q => q.tag_id)
    const [{ data: myCards }, { data: myMents }, { data: holders }] = await Promise.all([
      db.from('knowledge_cards').select('tag_id').eq('speaker_id', me.id).in('tag_id', tagIds),
      admin.from('tag_mentions').select('tag_id, live_id').eq('user_id', me.id).in('tag_id', tagIds),
      admin.from('user_tags').select('tag_id, user_id').eq('kind', 'knowledge').in('tag_id', tagIds),
    ])
    for (const q of quests ?? []) {
      const ids = (q.interested_ids ?? []).filter(id => id !== me.id)
      info.set(q.id, {
        tag: q.tags?.name ?? '?', reason: '', liveId: q.live_id,
        interested: ids.length,
        depts: [...new Set(ids.map(id => dept.get(id)).filter(Boolean))],
        cards: (myCards ?? []).filter(c => c.tag_id === q.tag_id).length,
        lives: new Set((myMents ?? []).filter(m => m.tag_id === q.tag_id).map(m => m.live_id)).size,
        holders: new Set((holders ?? []).filter(h => h.tag_id === q.tag_id).map(h => h.user_id)).size,
      })
    }
  }
  const open = (invites ?? []).filter(i => i.status === 'sent')
  const done = (invites ?? []).filter(i => i.status !== 'sent')

  return (
    <>
      <Topbar me={me} title="AIからの打診" sub="引き受けるか断るかは、あなたが決めます" />
      <div className="body">
        {open.length === 0 && <div className="card empty">いま届いている打診はありません</div>}
        {open.map(i => {
          const f = info.get(i.quest_id) ?? {}
          return (
            <div key={i.id} className="card sh" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="avt" style={{ width: 36, height: 36, background: 'var(--amber-bg)', color: 'var(--amber)' }}><Icon name="robot" size={18} /></span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <b>場づくりエージェント</b>
                  <span className="sub">{fmtWhen(i.sent_at)}</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="topic"><span className="sub">話題</span><span style={{ fontSize: 22, fontWeight: 700 }}>＃{f.tag}</span></div>
                <div className="topic"><span className="sub">興味を持っている人</span>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{f.interested ?? 0}人</span>
                  <span className="sub">{(f.depts ?? []).join('・') || '—'}</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="sub" style={{ fontWeight: 700 }}>依頼理由</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <Fact h={`知見カード ${f.cards ?? 0}枚`} t="この話題で、あなたの発言から生まれたカード" />
                  <Fact h={`ライブで話した ${f.lives ?? 0}回`} t="この話題に触れたライブの数" />
                  <Fact h={`社内に${f.holders ?? 0}人`} t="この知見タグを持っている人の数" />
                </div>
              </div>
              <div className="topic" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="clock" />
                <span style={{ fontSize: 13 }}><b>日程</b>：引き受けると、あなたの予定の<b>空いているかどうかだけ</b>を見て、エージェントが枠を決めて予約します（予定の中身は見ません）</span>
              </div>
              <InviteButtons id={i.id} />
            </div>
          )
        })}
        {done.length > 0 && <>
          <span className="sec">これまでの打診</span>
          <div className="card sh" style={{ padding: 12 }}>
            <table><thead><tr><th>話題</th><th>届いた日</th><th>返事</th></tr></thead><tbody>
              {done.map(i => (
                <tr key={i.id}><td>＃{info.get(i.quest_id)?.tag}</td><td>{fmtWhen(i.sent_at)}</td>
                  <td>{i.status === 'accepted' ? '引き受けた' : i.status === 'declined' ? '見送った' : '期限切れ'}</td></tr>
              ))}
            </tbody></table>
          </div>
        </>}
      </div>
    </>
  )
}

function Fact({ h, t }) {
  return (
    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <b style={{ fontSize: 16 }}>{h}</b><span className="sub">{t}</span>
    </div>
  )
}
