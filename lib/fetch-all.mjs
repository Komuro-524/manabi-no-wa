// Supabase（PostgREST）は1回に最大1000行しか返さない（既定の上限）。超えた分はエラーにならず黙って欠ける。
// 社員が数千人・年月で行が増えるテーブルは、ページを送って全部読む。
//   make: () => order 付きのクエリを毎回新しく作る関数（同じ順で並ばないとページの境目で重複・欠けが出る）
//   max : 読みすぎの天井。超えたらエラーを返して気づけるようにする（黙って切らない）
// 画面（Next.js）とエージェント（scripts/*.mjs）の両方から使う
export async function fetchAll(make, { page = 1000, max = 50000 } = {}) {
  const rows = []
  for (let from = 0; ; from += page) {
    const { data, error } = await make().range(from, from + page - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < page) return { data: rows, error: null }
    if (rows.length >= max) return { data: null, error: new Error(`${max}行を超えました。読み方（集計をDB側でする等）を見直してください`) }
  }
}
