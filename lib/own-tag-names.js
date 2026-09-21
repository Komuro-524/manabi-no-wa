import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 自分に付いている「育ちかけ」のタグの名前を引く。
// tags の RLS は「正式以外は管理者だけ」なので、本人のセッションだと自分のタグでも名前が null になる（QUESTIONS.md 候補A）。
// ★ 呼び出し元が「本人の行（user_tags / 本人が話したカード）から取った tag_id」だけを渡すこと。
//   他人のタグや辞書全体をここで引かない
export async function ownTagNames(tagIds) {
  const ids = [...new Set((tagIds ?? []).filter(Boolean))]
  if (!ids.length) return new Map()
  const { data } = await supabaseAdmin().from('tags').select('id, name, status, kind').in('id', ids)
  return new Map((data ?? []).map(t => [t.id, t]))
}
