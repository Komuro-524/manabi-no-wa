import Form from 'next/form'
import Link from '@/components/Link'
import { Icon } from './icons'
import Bell from './Bell'

export default function Topbar({ title, sub, me, children, hideSearch }) {
  return (
    <header className="topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <h1>{title}</h1>
        {sub && <span className="sub">{sub}</span>}
      </div>
      <span style={{ flexGrow: 1 }} />
      {children}
      {!hideSearch && <Form prefetch={false} action="/cards" style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', borderRadius: 10, padding: '0 12px', height: 40, background: 'var(--bg)' }}>
        <span style={{ color: 'var(--sub)' }}><Icon name="search" size={15} /></span>
        <input name="q" placeholder="知見カードを探す" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 150 }} />
      </Form>}
      <Bell />
      <Link href="/profile" className="avt" style={{ width: 32, height: 32, fontSize: 15 }} title={me.display_name}>{me.display_name.slice(0, 1)}</Link>
    </header>
  )
}
