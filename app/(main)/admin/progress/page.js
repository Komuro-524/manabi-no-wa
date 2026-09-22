import { requireAdmin } from '@/lib/admin-guard'
import { progressData, progressPage } from '@/lib/progress-data'
import Topbar from '@/components/Topbar'
import ProgressBoard from './ProgressBoard'

// ライブのタネ（DB上は quests）。場づくりエージェントが育てている「ライブになる前のタネ」を段階ごとに並べる。
// 最初の表示はサーバーで作り、あとは ProgressBoard が /api/admin/progress を数秒おきに読んで差し替える（画面ごと読み直さない）
export default async function Seeds({ searchParams }) {
  const me = await requireAdmin()
  const page = progressPage((await searchParams).page)
  const initial = await progressData(page)
  return <><Topbar me={me} title="ライブのタネ" sub="場づくりエージェントが育てている、ライブになる前のタネ" /><ProgressBoard key={page} initial={initial} /></>
}
