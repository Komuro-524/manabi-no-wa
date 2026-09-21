'use client'
import Link from '@/components/Link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/tags', label: 'タグ辞書' },
  { href: '/admin/progress', label: 'ライブのタネ', also: '/admin/quests' },
  { href: '/admin/agents', label: 'エージェント' },
  { href: '/admin/security', label: 'セキュリティ' },
  { href: '/admin/people', label: 'メンバー' },
]
export default function AdminNav() {
  const path = usePathname()
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 24px', background: '#FFFFFF', borderBottom: '1px solid var(--line)', overflowX: 'auto', flexShrink: 0 }}>
      <span className="chip" style={{ background: 'var(--ai)', color: '#FFF', marginRight: 6 }}>管理者ビュー</span>
      {ITEMS.map(i => <Link key={i.href} href={i.href} className={'tab' + (path === i.href || path === i.also ? ' tabon' : '')} style={{ minHeight: 34, padding: '6px 12px' }}>{i.label}</Link>)}
    </div>
  )
}
