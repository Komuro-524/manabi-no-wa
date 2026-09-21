import { requireAdmin } from '@/lib/admin-guard'
import AdminNav from '@/components/AdminNav'

export default async function AdminLayout({ children }) {
  await requireAdmin()   // ★ 管理者でなければここで追い返す（子の画面でも各自もう一度確かめる）
  return <><AdminNav />{children}</>
}
