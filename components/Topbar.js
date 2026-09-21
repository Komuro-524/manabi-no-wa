import { Icon } from './icons'

export default function Topbar({ title, sub, me, children }) {
  return (
    <header className="topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <h1>{title}</h1>
        {sub && <span className="sub">{sub}</span>}
      </div>
      <span style={{ flexGrow: 1 }} />
      {children}
      <span className="avt" style={{ width: 32, height: 32, fontSize: 15 }} title={me.display_name}>{me.display_name.slice(0, 1)}</span>
    </header>
  )
}
