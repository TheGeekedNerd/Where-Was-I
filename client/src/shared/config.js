// client/src/shared/config.js
const isProd = window.location.hostname !== 'localhost'

export const API_URL = isProd
  ? 'https://where-was-i-tz62.onrender.com'
  : 'http://localhost:5000'

export const AUTH0_DOMAIN = 'thegeekednerd.eu.auth0.com'
export const AUTH0_CLIENT_ID = '7VFQwXMNrA2zN843YiTzYouJso97K31K'