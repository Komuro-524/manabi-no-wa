'use client'
import { useState } from 'react'

// ライブの右側：「コメント」と「生まれたタグ」を切り替える（ブラウザの中だけで切り替わる）
export default function LivePanels({ comment, cards, cardsCount, initial }) {
  const [tab, setTab] = useState(initial)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button className={'tab' + (tab === 'comment' ? ' tabon' : '')} onClick={() => setTab('comment')}>コメント</button>
        <button className={'tab' + (tab === 'cards' ? ' tabon' : '')} onClick={() => setTab('cards')}>
          生まれたタグ{cardsCount > 0 && <span className="badge num" style={{ marginLeft: 4 }}>{cardsCount}</span>}
        </button>
        <span style={{ flexGrow: 1 }} />
        <span className="chip" style={{ background: 'var(--sand)', color: 'var(--ink2)' }}>発言はAIが読み、知見カードの材料になります</span>
      </div>
      {tab === 'comment' ? comment : cards}
    </>
  )
}
