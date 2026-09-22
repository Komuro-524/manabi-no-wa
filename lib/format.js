// 日時は日本時間で出す
const W = ['日', '月', '火', '水', '木', '金', '土']
export function fmtWhen(iso) {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${W[d.getUTCDay()]}）${hh}:${mm}`
}
// open-live で作るライブの題名は「会の名前 — テーマ」。テーマを主、会の名前を添え書きにする
export function splitTitle(title) {
  const [head, theme] = (title ?? '').split(' — ')
  return theme ? { main: theme, sub: head } : { main: head, sub: '' }
}
