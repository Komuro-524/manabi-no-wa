import { timingSafeEqual } from 'node:crypto'
export function authorizedCron(header, secret) {
  if (!secret || secret.length < 16 || typeof header !== 'string') return false
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(header)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
