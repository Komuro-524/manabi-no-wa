'use client'
import { useState } from 'react'

// 話し手の負担が1人に偏っていないかを、名前を横に並べた棒グラフで見る。
// タブで「知見カード」「話し手の相談（30日）」を切り替える。多い順に並べ、偏りが一目で分かるようにする
const TABS = [
  { k: 'cards', name: '知見カード', unit: '枚', warn: null },
  { k: 'invites', name: '話し手の相談（30日）', unit: '回', warn: 3 },   // 同じ人に週2回までの上限に近い人を朱色に
]

export default function BurdenChart({ rows }) {
  const [tab, setTab] = useState('invites')
  const t = TABS.find(x => x.k === tab)
  const data = [...rows].sort((a, b) => b[tab] - a[tab] || a.name.localeCompare(b.name, 'ja'))
  const max = Math.max(1, ...data.map(r => r[tab]))
  const total = data.reduce((s, r) => s + r[tab], 0)
  const top = data[0]
  const share = total ? Math.round((top[tab] / total) * 100) : 0

  return (
    <div className="card sh" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {TABS.map(x => (
          <button key={x.k} className={'tab' + (tab === x.k ? ' tabon' : '')} onClick={() => setTab(x.k)}>{x.name}</button>
        ))}
        <span style={{ flexGrow: 1 }} />
        {total > 0 && <span className="sub">いちばん多い {top.name}さんで全体の <b style={{ color: share >= 40 ? 'var(--shu)' : 'var(--ink)' }}>{share}%</b></span>}
      </div>
      {total === 0 ? <div className="empty">まだありません</div> : (
        <div className="noscrollbar" style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 190, minWidth: data.length * 34, borderBottom: '1px solid var(--line)', paddingTop: 16,
            backgroundImage: 'linear-gradient(to top, var(--line-soft) 1px, transparent 1px)', backgroundSize: '100% 25%' }}>
            {data.map(r => {
              const v = r[tab]
              const hot = t.warn != null && v >= t.warn
              return (
                <div key={r.id} title={`${r.name}：${v}${t.unit}`} style={{ flex: '1 0 28px', maxWidth: 48, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
                  <span className="num" style={{ fontSize: 11, color: hot ? 'var(--shu)' : 'var(--sub)', fontWeight: hot ? 700 : 400 }}>{v}</span>
                  <div style={{ width: '70%', height: `${(v / max) * 100}%`, minHeight: v ? 3 : 0, borderRadius: '4px 4px 0 0',
                    background: hot ? 'var(--shu)' : tab === 'cards' ? 'var(--blue)' : 'var(--ai-on)', transition: 'height .3s' }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, minWidth: data.length * 34, paddingTop: 6 }}>
            {data.map(r => (
              <span key={r.id} style={{ flex: '1 0 28px', maxWidth: 48, writingMode: 'vertical-rl', fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', height: 76, overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.name}</span>
            ))}
          </div>
        </div>
      )}
      {t.warn != null && <span className="note" style={{ margin: 0 }}>朱色は30日に{t.warn}回以上 相談が行った人。同じ人には1週間2回までに抑えています</span>}
    </div>
  )
}
