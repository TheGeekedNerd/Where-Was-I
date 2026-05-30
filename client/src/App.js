import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth0()
  if (isLoading) return React.createElement('div', null, 'Loading...')
  if (!isAuthenticated) return React.createElement(Navigate, { to: '/login', replace: true })
  return children
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth0()
  if (isLoading) return React.createElement('div', null, 'Loading...')
  return React.createElement(Navigate, { to: isAuthenticated ? '/dashboard' : '/login', replace: true })
}

function App() {
  return React.createElement(BrowserRouter, null,
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/', element: React.createElement(RootRedirect) }),
      React.createElement(Route, { path: '/login', element: React.createElement(Login) }),
      React.createElement(Route, { path: '/register', element: React.createElement(Register) }),
      React.createElement(Route, { path: '/dashboard', element:
        React.createElement(ProtectedRoute, null, React.createElement(Dashboard))
      })
    )
  )
}

export default App