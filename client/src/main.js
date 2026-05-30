import React from 'react'
import ReactDOM from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(Auth0Provider, {
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    cacheLocation: 'localstorage',
    authorizationParams: {
      redirect_uri: window.location.origin
    },
    onRedirectCallback: (appState) => {
      window.location.replace(appState?.returnTo || '/dashboard')
    }
  },
    React.createElement(App)
  )
)