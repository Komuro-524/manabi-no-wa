export function positiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`)
  return value
}
export function estimateCallCost(system, user, inputRate, outputRate) {
  // UTF-8 bytes overestimate typical token counts; routing/pricing is still external.
  return (Buffer.byteLength(system + user, 'utf8') * inputRate + 2048 * outputRate) / 1_000_000 * 1.25
}
