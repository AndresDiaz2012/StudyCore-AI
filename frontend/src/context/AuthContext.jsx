import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../utils/api'

const AuthContext = createContext(null)

// ── Theme applier ────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `${r} ${g} ${b}`
}

export function applyTheme(settings = {}) {
  const root = document.documentElement
  const body = document.body

  if (settings.brand_color) {
    root.style.setProperty('--c-brand', hexToRgb(settings.brand_color))
    // Derive light/dark automatically
    root.style.setProperty('--c-brand-light', hexToRgb(settings.brand_color))
    root.style.setProperty('--c-brand-dark',  hexToRgb(settings.brand_color))
  } else {
    root.style.removeProperty('--c-brand')
    root.style.removeProperty('--c-brand-light')
    root.style.removeProperty('--c-brand-dark')
  }

  const minFont = 12
  const fontSize = Math.max(minFont, parseInt(settings.font_size) || 14)
  root.style.setProperty('--font-size-base', `${fontSize}px`)

  if (settings.bg_color) {
    root.style.setProperty('--app-bg', settings.bg_color)
    body.style.backgroundColor = settings.bg_color
  } else {
    root.style.removeProperty('--app-bg')
    body.style.backgroundColor = ''
  }

  if (settings.bg_image) {
    body.style.backgroundImage = `url("${settings.bg_image}")`
    body.style.backgroundSize  = 'cover'
    body.style.backgroundAttachment = 'fixed'
  } else {
    body.style.backgroundImage = ''
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [pinLocked, setPinLocked] = useState(false)

  // Apply theme whenever user settings change
  useEffect(() => {
    if (user?.settings) {
      applyTheme(typeof user.settings === 'string' ? JSON.parse(user.settings) : user.settings)
    }
  }, [user?.settings])

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) { setLoading(false); return }

    authApi.me()
      .then((u) => {
        setUser(u)
        // Check PIN lock
        const settings = typeof u.settings === 'string' ? JSON.parse(u.settings || '{}') : (u.settings || {})
        if (settings.app_pin) setPinLocked(true)
      })
      .catch(() => localStorage.removeItem('auth_token'))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback((userData) => {
    localStorage.setItem('auth_token', userData.token)
    setUser(userData)
    const settings = typeof userData.settings === 'string'
      ? JSON.parse(userData.settings || '{}')
      : (userData.settings || {})
    if (settings.app_pin) setPinLocked(true)
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch (_) {}
    localStorage.removeItem('auth_token')
    setUser(null)
    setPinLocked(false)
    applyTheme({})
  }, [])

  const updateUser = useCallback((updates) => {
    setUser((prev) => ({ ...prev, ...updates }))
  }, [])

  const unlockPin = useCallback(() => setPinLocked(false), [])

  return (
    <AuthContext.Provider value={{ user, loading, pinLocked, login, logout, updateUser, unlockPin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
