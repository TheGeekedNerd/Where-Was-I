// No bundler = no import.meta.env. These are all public client-side
// values (Auth0 domain/client ID are meant to be public, not secrets),
// so a plain checked-in file is fine.
const isProd = window.location.hostname !== 'localhost'

export const API_URL = isProd
  ? 'https://where-was-i-tz62.onrender.com'
  : 'http://localhost:5000'

export const AUTH0_DOMAIN = 'your-tenant.us.auth0.com'
export const AUTH0_CLIENT_ID = 'your-auth0-client-id'