import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  return React.createElement(BrowserRouter, null,
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/', element: React.createElement(Navigate, { to: '/login', replace: true }) }),
      React.createElement(Route, { path: '/login', element: React.createElement(Login) }),
      React.createElement(Route, { path: '/register', element: React.createElement(Register) })
    )
  )
}

export default App