export type Verdict = 'healthy' | 'unstable' | 'degraded' | 'down' | 'starting' | 'stopped' | 'unknown'
export type Health = 'healthy' | 'pending' | 'failed' | 'neutral'

export type Follow = { name: string; repo: string; branch: string; added_at: string; pinned: boolean }

export type SpaceHealth = {
  verdict: Verdict
  up: number
  total: number
  culprits: { name: string; state: string }[]
  label: string
}

export type Rollout = {
  from_image: string
  to_image: string
  result: string
  reason?: string
  started_at: string
  finished_at?: string
}

export type ServiceView = {
  name: string
  state: string
  health: Health
  image: string
  oneshot: boolean
  port?: number
  routes: string[]
  replicas: number
  restarts: number
  since?: string
  rollouts: Rollout[]
  rejected?: string
}

export type Roll = {
  from_tag: string
  to_tag: string
  result: string
  error?: string
  created_at: string
  finished_at?: string
}

export type Watch = {
  name: string
  repo: string
  space: string
  service: string
  image: string
  tag_pattern: string
  current_tag: string
  status: string
  held_tag?: string
  last_error?: string
  last_checked_at?: string
  last_rolled_at?: string
  rolls: Roll[]
}

export type SpaceView = {
  name: string
  repo?: Follow
  url?: string
  health: SpaceHealth
  rolling: boolean
  images: string[]
  error?: string
  services?: ServiceView[]
  watches?: Watch[]
}

export type Overview = { node: string; verdict: Verdict; spaces: SpaceView[]; follows: Follow[] }

export type PublicContext = {
  name: string
  server: string
  token: string
  ca_fingerprint: string
  wipes_at: string
  wipe_label: string
}

const BASE = '/api/core/api/v1'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init)
  if (!res.ok) {
    let message = `the demo answered ${res.status}`
    try {
      const body = await res.json()
      if (typeof body?.message === 'string') message = body.message
    } catch {}
    throw new ApiError(res.status, message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  overview: () => call<Overview>('/spaces'),
  space: (name: string) => call<SpaceView>(`/spaces/${encodeURIComponent(name)}`),
  context: () => call<PublicContext>('/context'),
  follow: (repo: string, name?: string, branch?: string) =>
    call<Follow>('/follows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo, name: name || undefined, branch: branch || undefined }),
    }),
  restart: (space: string, service: string) =>
    call<void>(`/spaces/${encodeURIComponent(space)}/services/${encodeURIComponent(service)}/restart`, { method: 'POST' }),
  unfollow: (name: string) => call<void>(`/follows/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  logsURL: (space: string, service: string) =>
    `${BASE}/spaces/${encodeURIComponent(space)}/logs/${encodeURIComponent(service)}?follow=1`,
}

export function relativeTime(iso?: string, now = Date.now()) {
  if (!iso) return ''
  const at = new Date(iso).getTime()
  if (Number.isNaN(at) || at <= 0) return ''
  const secs = Math.round((now - at) / 1000)
  if (secs < 0) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60_000)
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h} h ${String(mins % 60).padStart(2, '0')} min` : `${mins} min`
}

const MINE_KEY = 'playground.mine'

export function mine(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(MINE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function rememberMine(name: string) {
  localStorage.setItem(MINE_KEY, JSON.stringify([...new Set([...mine(), name])]))
}
