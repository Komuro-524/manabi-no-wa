import 'server-only'
import { spawn } from 'node:child_process'
import path from 'node:path'

// scripts/*.mjs（CLI と同じエージェント）をサーバー側で子プロセスとして動かす。
// ★ 呼び出し元で管理者か確かめてから使う。引数はコード側で組み立てたものだけ（利用者の入力をそのまま渡さない）
export function runScript(file, args = [], timeoutMs = 170_000) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', file), ...args], { cwd: process.cwd() })
    let out = ''
    const timer = setTimeout(() => { child.kill(); out += '\n⏱️ 時間切れで止めました' }, timeoutMs)
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { out += d })
    child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, out: out.slice(-6000) }) })
  })
}
