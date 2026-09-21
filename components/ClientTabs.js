'use client'
import { useState } from 'react'

// 中身はサーバーで全部作っておき、タブの切り替えはブラウザの中だけで行う（押した瞬間に切り替わる）
export default function ClientTabs({ tabs, panels, initial, basePath }) {
  const [tab, setTab] = useState(tabs.some(([k]) => k === initial) ? initial : tabs[0][0])
  function pick(k) {
    setTab(k)
    try { window.history.replaceState(null, '', `${basePath}?tab=${k}`) } catch {}
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabs.map(([k, name]) => <button key={k} className={'tab' + (tab === k ? ' tabon' : '')} onClick={() => pick(k)}>{name}</button>)}
      </div>
      {panels[tab]}
    </>
  )
}
