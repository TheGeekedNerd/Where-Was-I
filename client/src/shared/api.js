import { API_URL } from './config.js'

export function authFetch(path, opts = {}) {
  const token = localStorage.getItem('token')
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      ...(opts.headers || {}),
    },
  })
}

export { API_URL as API }