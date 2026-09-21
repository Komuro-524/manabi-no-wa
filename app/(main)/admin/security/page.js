import Link from '@/components/Link'
import { requireAdmin } from '@/lib/admin-guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Topbar from '@/components/Topbar'
import { fmtWhen, splitTitle } from '@/lib/format'

// セキュリティ。★ 無いものは出さない（Firewall の遮断件数など、DBに無い数字は作らない）
export default async function AdminSecurity() {
  const me = await requireAdmin()
  const db = supabaseAdmin()
  const [{ data: review }, { data: giveups }, { data: failed }, { data: banned }] = await Promise.all([
    db.from('lives').select('id, title, ended_at').eq('ingest_status', 'needs_review').order('id', { ascending: false }),
    db.from('quest_steps').select('id, quest_id, reason, created_at').eq('kind', 'giveup').order('id', { ascending: false }).limit(20),
    db.from('agent_runs').select('id, agent, ref_id, error, started_at').eq('status', 'failed').order('id', { ascending: false }).limit(20),
    db.from('tags').select('id, name').eq('status', 'banned'),
  ])
  return (
    <>
      <Topbar me={me} title="セキュリティ" sub="設定していること・止まったもの・人に戻したもの" />
      <div className="body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ttl">守っていること</div>
            <Row h="なりすまし" t="その場にいない人の発言はDBが拒否する" />
            <Row h="見え方" t="育ちかけのカードは本人と管理者だけ。元の発言は参加者だけ" />
            <Row h="乗っ取り命令" t="AIには公開設定を変える手段を渡していない" />
            <Row h="個人情報" t="メール・電話・キーは伏せ、カード番号は止める（OrcaRouter）" />
          </div>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ttl">禁止したタグ（{(banned ?? []).length}）</div>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(banned ?? []).map(t => <span key={t.id} className="chip" style={{ background: 'var(--shu-bg)', color: 'var(--shu)' }}>{t.name}</span>)}
            </span>
            <Link className="btn btn-s" href="/admin/tags?tab=banned" style={{ alignSelf: 'flex-start' }}>タグ辞書で見る</Link>
          </div>
        </div>
        <List title={`人に戻したライブ（needs_review） ${(review ?? []).length}件`} empty="ありません"
          rows={(review ?? []).map(l => ({ k: l.id, a: <Link href={`/live/${l.id}`}>#{l.id} {splitTitle(l.title).main}</Link>, b: fmtWhen(l.ended_at) }))} />
        <List title={`あきらめたライブのタネ ${(giveups ?? []).length}件`} empty="ありません"
          rows={(giveups ?? []).map(s => ({ k: s.id, a: <Link href={`/admin/quests?id=${s.quest_id}`}>タネ #{s.quest_id}：{s.reason}</Link>, b: fmtWhen(s.created_at) }))} />
        <List title={`失敗したエージェントの実行 ${(failed ?? []).length}件`} empty="ありません"
          rows={(failed ?? []).map(r => ({ k: r.id, a: <span>#{r.id}（{r.agent}）{r.error}</span>, b: fmtWhen(r.started_at) }))} />
      </div>
    </>
  )
}
function Row({ h, t }) {
  return <div style={{ display: 'flex', gap: 10, fontSize: 13, borderBottom: '1px solid var(--line-soft)', paddingBottom: 6 }}><b style={{ width: 96, flexShrink: 0 }}>{h}</b><span>{t}</span></div>
}
function List({ title, rows, empty }) {
  return (
    <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="ttl">{title}</div>
      {rows.length === 0 && <span className="sub">{empty}</span>}
      {rows.map(r => <div key={r.k} style={{ display: 'flex', gap: 10, fontSize: 13 }}><span style={{ flexGrow: 1 }}>{r.a}</span><span className="sub">{r.b}</span></div>)}
    </div>
  )
}
