'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { Logo } from '@/components/icons'
import { COMPANY_NAME } from '@/lib/company'

// ★ デモ用のアカウント選択は localhost で動かすときだけのもの。
//   架空社員（0006_demo_seed.sql）の共通ダミーパスワードで入る。本番では出さない（SSO にする。DESIGN §10）
const DEMO_PASSWORD = 'demo-seed-not-a-real-login'
const DEMO = [
  { email: 'demo-matsunaga@example.invalid', name: '松永 蒼', note: '人事部・管理者' },
  { email: 'demo-hayasaka@example.invalid',  name: '早坂 悠人', note: '開発部' },
  { email: 'demo-sakuraba@example.invalid',  name: '桜庭 芽衣', note: '開発部' },
  { email: 'demo-kamiya@example.invalid',    name: '神谷 美月', note: '経理部' },
  { email: 'demo-hoshino@example.invalid',   name: '星野 陸',   note: '営業部' },
  { email: 'demo-fujishiro@example.invalid', name: '藤代 咲良', note: '総務部' },
]
const showDemo = typeof window !== 'undefined' ? ['localhost', '127.0.0.1'].includes(window.location.hostname) : true

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function signIn(e, p) {
    setBusy(true); setErr('')
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: e, password: p })
    setBusy(false)
    if (error) setErr('ログインできませんでした。メールとパスワードを確かめてください')
    else { router.replace('/livehub'); router.refresh() }
  }

  return (
    <div className="shippo-ai" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: 440, maxWidth: '100%', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: 'var(--ai)', borderRadius: 12, padding: 8, display: 'flex' }}><Logo size={30} /></span>
          <div>
            <div className="wa" style={{ fontSize: 26, fontWeight: 700 }}>まなびのわ</div>
            <div className="sub">{COMPANY_NAME}</div>
          </div>
        </div>
        <form onSubmit={e => { e.preventDefault(); signIn(email, password) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="inp" type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
          <input className="inp" type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          <button className="btn btn-p" disabled={busy}>ログイン</button>
        </form>
        {err && <div className="err">{err}</div>}
        {showDemo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <span className="sub"><b>デモ用</b>：架空の社員として入る（この端末で動かすときだけ表示）</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DEMO.map(d => (
                <button key={d.email} className="btn btn-s" disabled={busy} onClick={() => signIn(d.email, DEMO_PASSWORD)}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1, minHeight: 48 }}>
                  <span>{d.name}</span><span className="sub" style={{ fontWeight: 400 }}>{d.note}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
