// Calls one of our API routes and never throws: network failures and non-JSON replies come back
// as { ok: false, error } with a message a person can read.
export type HttpResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number }

export async function requestJSON<T = Record<string, unknown>>(
  url: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal }
): Promise<HttpResult<T>> {
  let response: Response
  try {
    response = await fetch(url, {
      method: init?.method || (init?.body === undefined ? 'GET' : 'POST'),
      headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init?.signal,
      cache: 'no-store',
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') return { ok: false, error: 'Cancelled.', status: 0 }
    return { ok: false, error: 'Could not reach StudyOS. Check your connection and try again.', status: 0 }
  }

  const data = await response.json().catch(() => null)
  if (!response.ok || data === null) {
    const message = (data as { error?: string } | null)?.error
    return {
      ok: false,
      status: response.status,
      error: message || (response.status === 401 ? 'Your session ended. Sign in again.' : 'Something went wrong. Try again.'),
    }
  }
  return { ok: true, data: data as T }
}
