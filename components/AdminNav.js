'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/tags', label: 'タグ辞書' },
  { href: '/admin/quests', label: '企ての一覧' },
]
export default function AdminNav() {
  const path = usePathname()
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '10px 24px', background: '#FFFFFF', borderBottom: '1px solid var(--line)' }}>
      <span className="chip" style={{ background: 'var(--ai)', color: '#FFF', marginRight: 6 }}>管理者ビュー</span>
      {ITEMS.map(i => <Link key={i.href} href={i.href} className={'tab' + (path === i.href ? ' tabon' : '')}>{i.label}</Link>)}
    </div>
  )
}
