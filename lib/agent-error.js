import 'server-only'
import { NextResponse } from 'next/server'
export function agentError(error) {
  return NextResponse.json({ error: error.code === '23505' ? 'いま実行中です。完了後に再度お試しください' :
    error.status === 429 ? '実行間隔または本日の回数制限に達しました' :
    '処理を完了できませんでした。管理画面の実行記録と設定を確認してください' },
    { status: error.code === '23505' ? 409 : error.status === 429 ? 429 : 500 })
}
