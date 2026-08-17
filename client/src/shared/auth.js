import { createAuth0Client } from 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2.1/dist/auth0-spa-js.production.esm.js'
import { AUTH0_DOMAIN, AUTH0_CLIENT_ID } from './config.js'

let auth0Client = null

async function getAuth0Client() {
    if (!auth0Client) {
    auth0Client = await createAuth0Client({
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        cacheLocation: 'localstorage',
        authorizationParams: {
        redirect_uri: window.location.origin,
        },
    })

    // Handle the redirect back from Auth0 (equivalent of onRedirectCallback)
    const query = window.location.search
    if (query.includes('code=') && query.includes('state=')) {
        const { appState } = await auth0Client.handleRedirectCallback()
        window.history.replaceState({}, document.title, window.location.pathname)
        window.location.replace(appState?.returnTo || '/src/pages/dashboard/dashboard.html')
    }
    }
    return auth0Client
}

export async function isAuth0Authenticated() {
    const client = await getAuth0Client()
    return client.isAuthenticated()
}

export async function loginWithConnection(connection) {
    const client = await getAuth0Client()
    await client.loginWithRedirect({ authorizationParams: { connection } })
}

export function hasLocalToken() {
    return !!localStorage.getItem('token')
}

export async function isLoggedIn() {
    return (await isAuth0Authenticated()) || hasLocalToken()
}

export async function loginWithAuth0() {
    const client = await getAuth0Client()
    await client.loginWithRedirect()
}

export async function getAuth0User() {
    const client = await getAuth0Client()
    return client.getUser()
}

export async function logout() {
    const client = await getAuth0Client()
    const wasAuth0 = await client.isAuthenticated()

    localStorage.removeItem('token')
    localStorage.removeItem('wwi_last_activity')

    if (wasAuth0) {
    await client.logout({
        logoutParams: { returnTo: window.location.origin + '/src/pages/login/login.html' },
    })
    } else {
    window.location.href = '/src/pages/login/login.html'
    }
}