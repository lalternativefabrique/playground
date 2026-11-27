const CORE_URL = (process.env.CORE_URL ?? 'http://localhost:4100').replace(/\/$/, '')

const FORWARDED = ['content-type', 'accept']

export async function coreProxy(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const target = CORE_URL + url.pathname.replace(/^\/api\/core/, '') + url.search
  const headers = new Headers()
  for (const name of FORWARDED) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    signal: request.signal,
    // @ts-expect-error duplex is required by undici to stream a request body
    duplex: hasBody ? 'half' : undefined,
  })
  const out = new Headers()
  for (const name of ['content-type', 'cache-control', 'x-accel-buffering']) {
    const value = res.headers.get(name)
    if (value) out.set(name, value)
  }
  return new Response(res.body, { status: res.status, headers: out })
}
