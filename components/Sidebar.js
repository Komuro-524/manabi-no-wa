'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, Logo } from './icons'
import { COMPANY_NAME } from '@/lib/company'
import LogoutButton from './LogoutButton'

function NavLink({ href, icon, label, badge, soon }) {
  const path = usePathname()
  const on = path === href || path.startsWith(href + '/')
  if (soon) {
    return <span className="nav" style={{ opacity: .45, cursor: 'default' }} title="準備中"><Icon name={icon} /><span>{label}</span><span style={{ marginLeft: 'auto', fontSize: 10 }}>準備中</span></span>
  }
  return (
    <Link className={'nav' + (on ? ' navon' : '')} href={href}>
      <Icon name={icon} /><span>{label}</span>
      {badge > 0 && <span className="badge num">{badge}</span>}
    </Link>
  )
}

export default function Sidebar({ me, liveCount, inviteCount }) {
  return (
    <nav className="side">
      <Link href="/livehub" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 8px 10px' }}>
        <Logo /><span className="wa" style={{ fontSize: 23, fontWeight: 700, color: '#FFFFFF' }}>まなびのわ</span>
      </Link>
      <div style={{ fontSize: 10, color: '#7C8AA3', padding: '0 8px 6px', letterSpacing: '.06em' }}>{COMPANY_NAME}</div>

      <div className="navlbl">まなぶ</div>
      <NavLink href="/livehub" icon="live" label="まなびのライブ" badge={liveCount} />
      <NavLink href="/cards" icon="cards" label="知見カード" />
      <NavLink href="/map" icon="map" label="知識地図" soon />

      <div className="navlbl">じぶん</div>
      <NavLink href="/profile" icon="profile" label="プロフィール" />
      <NavLink href="/invite" icon="invite" label="AIからの打診" badge={inviteCount} />
      <NavLink href="/selfscan" icon="scan" label="自己分析" soon />

      <span style={{ flexGrow: 1 }} />
      {me.role === 'admin' && (
        <Link className="nav" href="/admin">
          <Icon name="admin" /><span>管理者ビュー</span><span style={{ marginLeft: 'auto' }}><Icon name="arrow" size={14} /></span>
        </Link>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 10px 2px', marginTop: 8, borderTop: '1px solid rgba(255,255,255,.10)' }}>
        <span className="avt" style={{ width: 30, height: 30, fontSize: 15 }}>{me.display_name.slice(0, 1)}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>{me.display_name}</span>
          <span style={{ fontSize: 10, color: '#9AA6BC' }}>{me.department ?? ''}・{me.role === 'admin' ? '管理者' : '一般'}</span>
        </span>
        <LogoutButton />
      </div>
    </nav>
  )
}
