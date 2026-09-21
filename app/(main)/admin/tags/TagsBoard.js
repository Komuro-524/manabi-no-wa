'use client'
import { useState } from 'react'
import TagActions from './TagActions'

const TABS = [['all', 'すべて'], ['proposed', '格上げ候補'], ['candidate', '候補'], ['official', '正式'], ['rejected', '弾いた語'], ['banned', '禁止']]
const NAME = Object.fromEntries(TABS)

export default function TagsBoard({ tags, stats, meId, initialTab }) {
  const [tab, setTab] = useState(TABS.some(([k]) => k === initialTab) ? initialTab : 'proposed')
  const rows = tab === 'all' ? tags : tags.filter(t => t.status === tab)
  function pick(k) {
    setTab(k)
    try { window.history.replaceState(null, '', `/admin/tags?tab=${k}`) } catch {}
  }
  return (
    <div className="body" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(([k, name]) => (
          <button key={k} className={'tab' + (tab === k ? ' tabon' : '')} onClick={() => pick(k)}>
            {name}<span className="num" style={{ opacity: .7 }}>{k === 'all' ? tags.length : tags.filter(t => t.status === k).length}</span>
          </button>
        ))}
      </div>
      {tab === 'proposed' && <div className="note">直近30日に「3つのライブ」または「2人以上」が語った言葉です。正式にすると全員に見えるようになります</div>}
      <div className="card sh" style={{ padding: 12, flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
        {rows.length === 0 ? <div className="empty">ありません</div> : (
          <table>
            <thead><tr><th>タグ</th>{tab === 'all' && <th>状態</th>}<th>語られた（30日）</th><th></th></tr></thead>
            <tbody>
              {rows.map(t => {
                const s = stats[t.id]
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700 }}>{t.name}</td>
                    {tab === 'all' && <td className="sub">{NAME[t.status]}</td>}
                    <td className="num">{s ? `${s[0]}回・${s[1]}人` : '—'}</td>
                    <td><TagActions id={t.id} status={t.status} meId={meId} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
