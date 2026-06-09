import React, { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

const INACTIVITY_LIMIT = 15 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
const STORAGE_KEY = 'wwi_last_activity'

function isLoggedIn(isAuthenticated) {
  return isAuthenticated || !!localStorage.getItem('token')
}

function useInactivityLogout() {
  const { isAuthenticated, logout } = useAuth0()
  const navigate = useNavigate()
  const timerRef = useRef(null)

  useEffect(() => {
    if (!isLoggedIn(isAuthenticated)) return

    const updateActivity = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString())
    }

    const handleLogout = () => {
      clearInterval(timerRef.current)
      localStorage.removeItem('token')
      localStorage.removeItem(STORAGE_KEY)
      if (isAuthenticated) {
        logout({ logoutParams: { returnTo: window.location.origin + '/login' } })
      } else {
        navigate('/login')
      }
    }

    const checkInactivity = () => {
      const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
      if (Date.now() - last > INACTIVITY_LIMIT) {
        handleLogout()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity()
      }
    }

    updateActivity()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, updateActivity))
    document.addEventListener('visibilitychange', handleVisibility)
    timerRef.current = setInterval(checkInactivity, 30 * 1000)

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, updateActivity))
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(timerRef.current)
    }
  }, [isAuthenticated])
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth0()
  useInactivityLogout()
  if (isLoading) return React.createElement('div', null, 'Loading...')
  if (!isLoggedIn(isAuthenticated)) return React.createElement(Navigate, { to: '/login', replace: true })
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth0()
  if (isLoading) return React.createElement('div', null, 'Loading...')
  if (isLoggedIn(isAuthenticated)) return React.createElement(Navigate, { to: '/dashboard', replace: true })
  return children
}

function RootRedirect() {
  const { isAuthenticated, isLoading, logout } = useAuth0()
  useEffect(() => {
    localStorage.removeItem('token')
    localStorage.removeItem(STORAGE_KEY)
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
      React.createElement(Route, { path: '/login', element:
        React.createElement(PublicRoute, null, React.createElement(Login))
      }),
      React.createElement(Route, { path: '/register', element:
        React.createElement(PublicRoute, null, React.createElement(Register))
      }),
      React.createElement(Route, { path: '/forgot-password', element:
        React.createElement(PublicRoute, null, React.createElement(ForgotPassword))
      }),
      React.createElement(Route, { path: '/reset-password/:token', element:
        React.createElement(PublicRoute, null, React.createElement(ResetPassword))
      }),
      React.createElement(Route, { path: '/dashboard', element:
        React.createElement(ProtectedRoute, null, React.createElement(Dashboard))
      })
    )
  )
}

export default App