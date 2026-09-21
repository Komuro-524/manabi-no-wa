import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import { fmtWhen, splitTitle } from '@/lib/format'

// おしらせ。ベルを開いたときだけ読む（画面の表示を遅くしないため）。全部 本人のセッション＝RLS の範囲だけ
export async function GET() {
  const me = await currentUser()
  if (!me) return NextResponse.json({ items: [] }, { status: 401 })
  const db = await supabaseServer()
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const [{ data: myTags }, { count: invites }, { data: lives }, { data: parts }] = await Promise.all([
    db.from('user_tags').select('tag_id, kind, source, visibility, updated_at, tags(name, status)').eq('user_id', me.id),
    db.from('invitations').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    db.from('lives').select('id, title, scheduled_start, topic_tag_id').eq('status', 'scheduled').order('scheduled_start'),
    db.from('live_participants').select('live_id').eq('user_id', me.id),
  ])
  const items = []
  const fresh = (myTags ?? []).filter(t => t.updated_at >= weekAgo && t.source !== 'self')
  if (fresh.length) {
    const names = fresh.map(t => t.tags?.name ?? '育ちかけのタグ')
    items.push({ kind: 'tag', title: '新たについたタグ', text: names.slice(0, 2).join('・') + (names.length > 2 ? ` ほか${names.length - 2}件` : ''), href: '/profile' })
  }
  if (invites) items.push({ kind: 'invite', title: '話し手の依頼', text: `場づくりエージェントから ${invites}件の打診が届いています`, href: '/invite' })
  const adopt = (myTags ?? []).filter(t => t.source === 'self' && t.visibility === 'private').length
  if (adopt) items.push({ kind: 'self', title: '自己分析のタグ', text: `採用を待っているタグが ${adopt}件あります`, href: '/profile' })

  const interestIds = (myTags ?? []).filter(t => t.kind === 'interest' && t.tags?.status === 'official').map(t => t.tag_id)
  if (interestIds.length) {
    const { count } = await db.from('knowledge_cards').select('id', { count: 'exact', head: true }).in('tag_id', interestIds).gte('created_at', weekAgo).neq('speaker_id', me.id)
    if (count) items.push({ kind: 'card', title: '新しい知見カード', text: `あなたの興味タグのカードが ${count}件増えました`, href: '/cards' })
  }
  const mine = new Set((parts ?? []).map(p => p.live_id))
  for (const l of (lives ?? []).filter(l => mine.has(l.id) || interestIds.includes(l.topic_tag_id)).slice(0, 2)) {
    items.push({ kind: 'live', title: 'まなびのライブ', text: `＃${splitTitle(l.title).main} が ${fmtWhen(l.scheduled_start)} に開催予定`, href: `/live/${l.id}` })
  }
  return NextResponse.json({ items })
}
