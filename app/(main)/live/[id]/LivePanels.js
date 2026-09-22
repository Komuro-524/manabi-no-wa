'use client'
import { useState } from 'react'

// ライブの右側：「チャット」と「生まれたタグ」を切り替える（文字起こしは別の枠で常に見える）（ブラウザの中だけで切り替わる）
export default function LivePanels({ comment, cards, cardsCount, initial }) {
  const [tab, setTab] = useState(initial)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button className={'tab' + (tab === 'comment' ? ' tabon' : '')} onClick={() => setTab('comment')}>💬 チャット</button>
        <button className={'tab' + (tab === 'cards' ? ' tabon' : '')} onClick={() => setTab('cards')}>
          生まれたタグ{cardsCount > 0 && <span className="badge num" style={{ marginLeft: 4 }}>{cardsCount}</span>}
        </button>
      </div>
      {tab === 'comment' ? comment : cards}
    </>
  )
}
