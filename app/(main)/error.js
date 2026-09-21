'use client'
// 画面の中でエラーが起きたとき、読み込み中のまま固まらずに理由を出す
export default function ErrorView({ error, reset }) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="err">この画面を表示できませんでした：{error?.message || '不明なエラー'}</div>
      <button className="btn" onClick={() => reset()} style={{ alignSelf: 'flex-start' }}>もう一度読み込む</button>
    </div>
  )
}
