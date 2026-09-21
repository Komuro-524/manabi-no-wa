// 日時は日本時間で出す
const W = ['日', '月', '火', '水', '木', '金', '土']
export function fmtWhen(iso) {
  if (!iso) return ''
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()}（${W[d.getDay()]}）${hh}:${mm}`
}
// open-live で作るライブの題名は「会の名前 — テーマ」。テーマを主、会の名前を添え書きにする
export function splitTitle(title) {
  const [head, theme] = (title ?? '').split(' — ')
  return theme ? { main: theme, sub: head } : { main: head, sub: '' }
}
