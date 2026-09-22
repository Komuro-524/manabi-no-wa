import { requireAdmin } from '@/lib/admin-guard'
import { progressData, progressPage } from '@/lib/progress-data'
import Topbar from '@/components/Topbar'
import ProgressBoard from './ProgressBoard'
export default async function Seeds({ searchParams }) {
  const me = await requireAdmin()
  const page = progressPage((await searchParams).page)
  const initial = await progressData(page)
  return <><Topbar me={me} title="ライブのタネ" sub="場づくりエージェントが育てている、ライブになる前のタネ" /><ProgressBoard key={page} initial={initial} /></>
}
