import sharp from 'sharp'
export const MAX_BODY_BYTES = 4_000_000
export const MAX_FRAME_BYTES = 512_000
export const MAX_FRAMES = 12
export const MAX_PIXELS = 1920 * 1080
export class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
export async function readLimitedJson(req) {
  const length = req.headers.get('content-length')
  if (length && Number(length) > MAX_BODY_BYTES) throw new InputError('画像の合計容量が大きすぎます（全体で4MBまで）', 413)
  if (!req.body) throw new InputError('画像がありません')
  const reader = req.body.getReader(), chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new InputError('画像の合計容量が大きすぎます（全体で4MBまで）', 413) }
      chunks.push(Buffer.from(value))
    }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new InputError('入力形式が正しくありません') }
}
export async function validateFrames(frames) {
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > MAX_FRAMES) throw new InputError(`静止画は2〜${MAX_FRAMES}枚にしてください`)
  let total = 0
  for (const frame of frames) {
    if (typeof frame !== 'string' || frame.length > Math.ceil(MAX_FRAME_BYTES / 3) * 4 + 40) throw new InputError('画像は1枚512KBまでです', 413)
    total += Buffer.byteLength(frame)
    if (total > MAX_BODY_BYTES - 2048) throw new InputError('画像の合計容量が大きすぎます', 413)
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(frame)
    if (!match) throw new InputError('PNG・JPEG・WebP形式の静止画を指定してください')
    const bytes = Buffer.from(match[2], 'base64')
    if (bytes.length > MAX_FRAME_BYTES) throw new InputError('画像は1枚512KBまでです', 413)
    if (bytes.toString('base64') !== match[2]) throw new InputError('画像データが壊れています')
    try {
      const meta = await sharp(bytes, { limitInputPixels: MAX_PIXELS, animated: true }).metadata()
      if (meta.format !== match[1] || !meta.width || !meta.height || meta.width > 1920 || meta.height > 1080 ||
          meta.width * meta.height > MAX_PIXELS || (meta.pages ?? 1) !== 1) throw new Error('invalid size/format')
      // Decode to catch truncated files; memory is bounded by the pixel and frame limits.
      await sharp(bytes, { limitInputPixels: MAX_PIXELS }).raw().toBuffer()
    } catch { throw new InputError('画像は1920×1080以内の正常な静止画にしてください') }
  }
  return frames
}
export function scanMeta(body) {
  const started = new Date(body.started_at), ended = new Date(body.ends_at)
  if (!Number.isFinite(started.getTime()) || !Number.isFinite(ended.getTime()) || ended < started || ended - started > 2 * 60 * 60 * 1000) {
    throw new InputError('分析の開始・終了日時が正しくありません')
  }
  return { started_at: started.toISOString(), ends_at: ended.toISOString(), granularity: body.granularity === 'screen' ? 'screen' : 'window' }
}
