const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'
export const api = async (path, { method = 'GET', body, token } = {}) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
