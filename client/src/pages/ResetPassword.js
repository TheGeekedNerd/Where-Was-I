import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './auth.css'

function ResetPassword() {
    const navigate = useNavigate()
    const { token } = useParams()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [message, setMessage] = useState('')
    const [isError, setIsError] = useState(false)
    const [loading, setLoading] = useState(false)
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const handleReset = async () => {
    if (!password || !confirm) return (setMessage('Please fill in all fields'), setIsError(true))
    if (password !== confirm) return (setMessage('Passwords do not match'), setIsError(true))
    setLoading(true)
    try {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
        })
        const data = await res.json()
        setMessage(data.message)
        setIsError(!res.ok)
        if (res.ok) setTimeout(() => navigate('/login'), 2000)
    } catch {
        setMessage('Server error')
        setIsError(true)
    } finally {
        setLoading(false)
    }
    }

    return React.createElement('div', { className: 'auth-wrapper' },
    React.createElement('div', { className: 'panel image-panel login-panel' },
    React.createElement('div', { className: 'slide slide-1 slide-odd' }),
    React.createElement('div', { className: 'slide slide-2 slide-even' }),
    React.createElement('div', { className: 'slide slide-3 slide-odd' }),
    React.createElement('div', { className: 'slide slide-4 slide-even' }),
    React.createElement('div', { className: 'slide slide-5 slide-odd' }),
    React.createElement('div', { className: 'slide slide-6 slide-even' }),
    React.createElement('div', { className: 'overlay' })
    ),
    React.createElement('div', { className: 'panel form-panel' },
    React.createElement('div', { className: 'form-box' },
        React.createElement('h1', { className: 'auth-title' }, 'Reset password'),
        React.createElement('p', { className: 'auth-sub' }, 'Choose a new password for your account'),
        message && React.createElement('p', {
        className: 'auth-message',
        style: { color: isError ? '#e74c3c' : '#00ff89' }
        }, message),
        React.createElement('label', { className: 'field-label' }, 'New password'),
        React.createElement('input', {
        className: 'field-input',
        type: 'password',
        placeholder: '••••••••',
        onChange: (e) => setPassword(e.target.value)
        }),
        React.createElement('label', { className: 'field-label' }, 'Confirm password'),
        React.createElement('input', {
        className: 'field-input',
        type: 'password',
        placeholder: '••••••••',
        onChange: (e) => setConfirm(e.target.value)
        }),
        React.createElement('button', {
        className: 'primary-btn',
        onClick: handleReset,
        disabled: loading
        }, loading ? 'Resetting…' : 'Reset password'),
        React.createElement('p', { className: 'switch-text' },
        React.createElement('span', {
            className: 'switch-link',
            onClick: () => navigate('/login')
            }, '← Back to login')
        )
        )
    )
    )
}

export default ResetPassword