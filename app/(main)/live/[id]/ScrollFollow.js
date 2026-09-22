'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// 新しい行が下に増えていく枠（文字起こし・チャット）。Teams の会議の文字起こしと同じふるまい:
// ・いちばん下を見ているときは、新しい行が来たら自動で下までついていく
// ・上にさかのぼって読んでいる間は、勝手に動かさない（読んでいる場所を奪わない）
// ・そのあいだに新しい行が来たら「↓ 新しい発言 n件」ボタンを出し、押すと最新へ戻る
// ★ 画面は数秒おきに読み直されるので、スクロール位置はこの部品が覚えておく
export default function ScrollFollow({ count, label = '新しい発言', children, style }) {
  const box = useRef(null)
  const atBottom = useRef(true)
  const seen = useRef(count)
  const [unread, setUnread] = useState(0)

  const toBottom = (smooth) => {
    const el = box.current; if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    atBottom.current = true; seen.current = count; setUnread(0)
  }
  // 最初に開いたときは最新（いちばん下）を見せる
  useLayoutEffect(() => { toBottom(false) }, [])
  // 行が増えたとき
  useLayoutEffect(() => {
    if (count <= seen.current) { seen.current = count; return }
    if (atBottom.current) toBottom(false)
    else setUnread(count - seen.current)
  }, [count])

  function onScroll() {
    const el = box.current
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    atBottom.current = near
    if (near && unread) { seen.current = count; setUnread(0) }
  }

  return (
    <div style={{ position: 'relative', flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div ref={box} onScroll={onScroll} style={{ overflowY: 'auto', flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...style }}>
        {children}
      </div>
      {unread > 0 && (
        <button type="button" className="btn btn-p btn-s" onClick={() => toBottom(true)}
          style={{ position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)', boxShadow: '0 6px 16px rgba(28,43,61,.25)' }}>
          ↓ {label} {unread}件
        </button>
      )}
    </div>
  )
}
