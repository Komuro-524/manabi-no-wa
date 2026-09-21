'use client'
import { useEffect, useState } from 'react'

// 配信が始まってからの時間（1秒ごとに進む）
export default function Elapsed({ since }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  if (!since) return <span>配信中</span>
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000))
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60
  return <span className="num">{h ? `${h}:` : ''}{String(m).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
}
