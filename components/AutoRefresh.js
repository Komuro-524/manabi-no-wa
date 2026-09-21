'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 進行中のものがある間だけ、数秒おきに画面のデータを読み直す
export default function AutoRefresh({ active, every = 4000 }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    // タブが裏にあるときは読み直さない（無駄な通信で重くしない）
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, every)
    // 裏にしていたタブに戻ってきたら、すぐに読み直す（戻ったのに古いまま、を防ぐ）
    const onVis = () => { if (document.visibilityState === 'visible') router.refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [active, every, router])
  return null
}
