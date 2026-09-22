// Read requests must finish or fail visibly. Do not retry writes (duplicate side effects).
export function createScreenFetch({ timeout = 12000, fetcher = globalThis.fetch } = {}) {
  return async (input, init = {}) => {
    const controller = new AbortController()
    const upstream = init.signal ?? (input instanceof Request ? input.signal : undefined)
    const abort = () => controller.abort(upstream.reason)
    if (upstream?.aborted) abort()
    else upstream?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => controller.abort(new DOMException('Database request timed out', 'TimeoutError')), timeout)
    try {
      const response = await fetcher(input, { ...init, signal: controller.signal })
      // Include reading the body in the deadline (fetch resolves at headers).
      const body = response.body === null ? null : await response.arrayBuffer()
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
    }
    finally { clearTimeout(timer); upstream?.removeEventListener('abort', abort) }
  }
}
export const screenFetch = createScreenFetch()
