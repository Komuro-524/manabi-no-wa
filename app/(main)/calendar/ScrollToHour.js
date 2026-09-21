'use client'
import { useEffect, useRef } from 'react'
// 週・日の表示で、最初に朝8時あたりまで送っておく（上下にスクロールして前後の時間も見られる）
export default function ScrollToHour({ hour, unit, children }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = hour * unit }, [hour, unit])
  return <div ref={ref} style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
}
