import 'server-only'
import { spawn } from 'node:child_process'
import path from 'node:path'

// scripts/*.mjs（CLI と同じエージェント）をサーバー側で子プロセスとして動かす。
// ★ 呼び出し元で管理者か確かめてから使う。引数はコード側で組み立てたものだけ（利用者の入力をそのまま渡さない）
export function runScript(file, args = [], timeoutMs = 170_000, stdinText = null) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', file), ...args], { cwd: process.cwd() })
    let out = ''
    // 画像など大きい入力はファイルにせず標準入力で渡す（ディスクに残さない）
    if (stdinText != null) { child.stdin.write(stdinText); child.stdin.end() }
    const timer = setTimeout(() => { child.kill(); out += '\n⏱️ 時間切れで止めました' }, timeoutMs)
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { out += d })
    child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, out: out.slice(-6000) }) })
  })
}

// 待たずに裏で動かす（画面はすぐ返し、進み具合は DB の状態で見せる）。
// ★ 呼び出し元で管理者か確かめてから使う。結果は各エージェントが agent_runs / lives に書く
export function runDetached(file, args = []) {
  const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', file), ...args], {
    cwd: process.cwd(), detached: true, stdio: 'ignore', windowsHide: true,
  })
  child.unref()
}
