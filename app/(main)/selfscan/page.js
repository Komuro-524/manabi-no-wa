import Link from 'next/link'
import { supabaseServer, currentUser } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import { fmtWhen } from '@/lib/format'
import ScanClient, { ScanLog } from './ScanClient'

// 自己分析。自分の記録（self_analysis_sessions）と、自己分析から付いたタグは本人にだけ見える（RLS）
export default async function SelfScan() {
  const me = await currentUser()
  const db = await supabaseServer()
  const [{ data: sessions }, { data: selfTags }] = await Promise.all([
    db.from('self_analysis_sessions').select('id, frame_count, granularity, started_at, finished_at').order('id', { ascending: false }).limit(5),
    db.from('user_tags').select('id, visibility, tags(name, status)').eq('user_id', me.id).eq('source', 'self'),
  ])
  const waiting = (selfTags ?? []).filter(t => t.visibility === 'private').length

  return (
    <>
      <Topbar me={me} title="自己分析" sub="ふだんの作業画面から、あなたが話せそうなことをAIが見つけます" />
      <div className="body" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}><ScanClient /></div>
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ttl">約束</div>
            <span style={{ fontSize: 13, lineHeight: 1.7 }}>
              ・映すのは<b>あなたが選んだ画面だけ</b>。途中でいつでも止められます<br />
              ・<b>画像は保存しません</b>。サーバーでもファイルにもDBにも書かず、分析が終われば消えます<br />
              ・見つかったタグは<b>非公開</b>で付きます。公開するかは、あなたがプロフィールで決めます<br />
              ・1枚にしか映らなかったものは付けません（たまたま開いた画面を拾わないため）
            </span>
          </div>
          <div className="card sh" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ttl">これまでの自己分析</div>
            {(sessions ?? []).length === 0 && <span className="sub">まだありません</span>}
            {(sessions ?? []).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{fmtWhen(s.finished_at ?? s.started_at)}</span><span className="sub">{s.frame_count}枚</span>
              </div>
            ))}
            <ScanLog />
            {waiting > 0 && <Link className="btn btn-s btn-p" href="/profile?tab=knowledge" style={{ alignSelf: 'flex-start' }}>採用を待っているタグ {waiting}件</Link>}
          </div>
        </div>
      </div>
    </>
  )
}
