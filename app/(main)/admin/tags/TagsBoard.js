'use client'
import { useEffect, useState } from 'react'
import TagActions from './TagActions'
import TagDeck from './TagDeck'

const TABS = [['all', 'すべて'], ['requested', '申請あり'], ['proposed', '格上げ候補'], ['candidate', '候補'], ['official', '正式'], ['rejected', '弾いた語'], ['banned', '禁止']]
const NAME = Object.fromEntries(TABS)

export default function TagsBoard({ tags, stats, requests = {}, meId, initialTab }) {
  const [tab, setTab] = useState(TABS.some(([k]) => k === initialTab) ? initialTab : 'proposed')
  // 申請つきの育ちかけタグは「申請あり」タブに集め、ほかのタブでも上に出す（少数しか知らない価値ある知識を見落とさない）
  const growing = t => t.status === 'candidate' || t.status === 'proposed'
  const req = t => (growing(t) ? requests[t.id] ?? 0 : 0)
  const inTab = (t, k) => k === 'all' ? true : k === 'requested' ? req(t) > 0 : t.status === k
  const rows = tags.filter(t => inTab(t, tab)).sort((a, b) => req(b) - req(a))

  // 単語帳に綴じる札: 申請つき → 格上げ候補 の順。開いたとき（このタブで最初の1回）に暗転して浮かび上がる
  const deck = tags.filter(t => growing(t) && (req(t) > 0 || t.status === 'proposed'))
    .sort((a, b) => req(b) - req(a) || (b.status === 'proposed') - (a.status === 'proposed'))
    .map(t => ({ id: t.id, name: t.name, status: t.status, requests: req(t), lives: stats[t.id]?.[0] ?? 0, people: stats[t.id]?.[1] ?? 0 }))
  const [deckOpen, setDeckOpen] = useState(false)
  useEffect(() => {
    if (!deck.length) return
    let seen = false
    try { seen = sessionStorage.getItem('tagDeckSeen') === '1'; sessionStorage.setItem('tagDeckSeen', '1') } catch {}
    if (!seen) setDeckOpen(true)
  }, [])
  function pick(k) {
    setTab(k)
    try { window.history.replaceState(null, '', `/admin/tags?tab=${k}`) } catch {}
  }
  return (
    <div className="body" style={{ overflow: 'hidden' }}>
      {deckOpen && <TagDeck deck={deck} meId={meId} onClose={() => setDeckOpen(false)} />}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {TABS.map(([k, name]) => (
          <button key={k} className={'tab' + (tab === k ? ' tabon' : '')} onClick={() => pick(k)}>
            {name}<span className="num" style={{ opacity: .7 }}>{tags.filter(t => inTab(t, k)).length}</span>
          </button>
        ))}
        <span style={{ flexGrow: 1 }} />
        {deck.length > 0 && <button className="btn btn-p btn-s" onClick={() => setDeckOpen(true)}>単語帳で仕分ける（{deck.length}枚）</button>}
      </div>
      {tab === 'requested' && <div className="note">話した本人が「タグにしてほしい」と申請した育ちかけのタグです。語られた回数が少なくても、価値のある知識かもしれません</div>}
      {tab === 'proposed' && <div className="note">直近30日に「3つのライブ」または「2人以上」が語った言葉です。正式にすると全員に見えるようになります</div>}
      <div className="card sh" style={{ padding: 12, flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
        {rows.length === 0 ? <div className="empty">ありません</div> : (
          <table>
            <thead><tr><th>タグ</th>{tab === 'all' && <th>状態</th>}<th>語られた（30日）</th><th>申請</th><th></th></tr></thead>
            <tbody>
              {rows.map(t => {
                const s = stats[t.id]
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700 }}>{t.name}</td>
                    {tab === 'all' && <td className="sub">{NAME[t.status]}</td>}
                    <td className="num">{s ? `${s[0]}回・${s[1]}人` : '—'}</td>
                    <td>{req(t) > 0 ? <span className="chip" style={{ background: 'var(--shu-bg)', color: 'var(--shu)' }}>{req(t)}人</span> : <span className="sub">—</span>}</td>
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
