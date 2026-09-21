'use client'
import { useRouter } from 'next/navigation'

// タグはこれからどんどん増えるので、横に並べず選ぶ形にする
export default function TagSelect({ tags, value, q }) {
  const router = useRouter()
  return (
    <select className="inp" value={value ?? ''} style={{ width: 260, minHeight: 40 }} aria-label="タグで絞る"
      onChange={e => {
        const p = new URLSearchParams()
        if (q) p.set('q', q)
        if (e.target.value) p.set('tag', e.target.value)
        router.push('/cards?' + p.toString())
      }}>
      <option value="">すべてのタグ（{tags.length}）</option>
      {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  )
}
