const BASE = import.meta.env.VITE_API_URL ?? ''

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...fetchOpts } = options ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    ...fetchOpts,
    headers: { ...headers, ...(fetchOpts.headers as Record<string, string>) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}
