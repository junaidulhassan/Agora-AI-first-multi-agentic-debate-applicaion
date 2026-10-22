const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  constructor(message, { code = 'unknown_error', status = 0, details = {} } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new ApiError('Cannot reach the Agora server. Check that the backend is running.', { code: 'network_error' })
  }
  if (response.status === 204) return null
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    const error = body?.error ?? {}
    throw new ApiError(error.message ?? `Request failed (${response.status})`, {
      code: error.code,
      status: response.status,
      details: error.details,
    })
  }
  return body
}

export const api = {
  config: () => request('/api/config'),
  listDebates: () => request('/api/debates'),
  getDebate: (id) => request(`/api/debates/${id}`),
  createDebate: (question, topic) =>
    request('/api/debates', { method: 'POST', body: JSON.stringify({ question, topic }) }),
  cancelDebate: (id) => request(`/api/debates/${id}/cancel`, { method: 'POST' }),
  deleteDebate: (id) => request(`/api/debates/${id}`, { method: 'DELETE' }),
}

export function websocketUrl(debateId, after) {
  const explicit = import.meta.env.VITE_WS_BASE
  const base = explicit ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
  return `${base}/ws/debates/${debateId}?after=${after}`
}
