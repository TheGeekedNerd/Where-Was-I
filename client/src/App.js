import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

function isLoggedIn(isAuthenticated) {
  return isAuthenticated || !!localStorage.getItem('token')
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth0()
  if (isLoading) return React.createElement('div', null, 'Loading...')
  if (!isLoggedIn(isAuthenticated)) return React.createElement(Navigate, { to: '/login', replace: true })
  return children
}

function RootRedirect() {
  const { isAuthenticated, isLoading, logout } = useAuth0()

  useEffect(() => {
    localStorage.removeItem('token')
    if (isAuthenticated) {
      logout({ logoutParams: { returnTo: window.location.origin + '/login' } })
    }
  }, [isAuthenticated])

  if (isLoading) return React.createElement('div', null, 'Loading...')
  return React.createElement(Navigate, { to: '/login', replace: true })
}

function App() {
  return React.createElement(BrowserRouter, null,
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/', element: React.createElement(RootRedirect) }),
      React.createElement(Route, { path: '/login', element: React.createElement(Login) }),
      React.createElement(Route, { path: '/register', element: React.createElement(Register) }),
      React.createElement(Route, { path: '/forgot-password', element: React.createElement(ForgotPassword) }),
      React.createElement(Route, { path: '/reset-password/:token', element: React.createElement(ResetPassword) }),
      React.createElement(Route, { path: '/dashboard', element:
        React.createElement(ProtectedRoute, null, React.createElement(Dashboard))
      })
    )
  )
}

export default App