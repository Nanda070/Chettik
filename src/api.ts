const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export const API_URL = configuredApiUrl || 'http://127.0.0.1:8787/api'

export function websocketUrl() {
  if (!configuredApiUrl) return 'ws://127.0.0.1:8787/api/ws'
  const url = new URL(configuredApiUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`
  return url.toString()
}
