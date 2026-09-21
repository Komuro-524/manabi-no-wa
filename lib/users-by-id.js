// 画面に出てくる人だけを読む。
// ★ 全社員を毎回読むと、社員が1000人を超えたところで Supabase の既定の上限（1回1000行）で黙って欠ける。
//   ids は200件ずつに分けて並べて読む（URL が長くなりすぎないように）
export async function usersByIds(db, ids, cols = 'id, display_name, department') {
  const uniq = [...new Set((ids ?? []).filter(Boolean))]
  const map = new Map()
  const chunks = []
  for (let i = 0; i < uniq.length; i += 200) chunks.push(uniq.slice(i, i + 200))
  const results = await Promise.all(chunks.map(c => db.from('users').select(cols).in('id', c)))
  for (const { data } of results) for (const u of data ?? []) map.set(u.id, u)
  return map
}
