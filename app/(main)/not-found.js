import Link from '@/components/Link'

// 無いライブ・無いページを開いたとき（読み込み中のまま固まらずに、無いと伝える）
export default function NotFound() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <div className="note">お探しのページは見つかりませんでした。消えたか、URLが違うかもしれません</div>
      <Link className="btn" href="/livehub">まなびのライブへ戻る</Link>
    </div>
  )
}
