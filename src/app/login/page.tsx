'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const STORAGE_KEY_ATTEMPTS = 'es_auth_attempts'
const STORAGE_KEY_LOCKOUT = 'es_auth_lockout'

function getStoredAttempts(): number {
  if (typeof window === 'undefined') return 0
  const val = localStorage.getItem(STORAGE_KEY_ATTEMPTS)
  return val ? parseInt(val, 10) : 0
}

function getStoredLockout(): number | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(STORAGE_KEY_LOCKOUT)
  if (!val) return null
  const expiry = parseInt(val, 10)
  if (Date.now() >= expiry) {
    localStorage.removeItem(STORAGE_KEY_LOCKOUT)
    localStorage.removeItem(STORAGE_KEY_ATTEMPTS)
    return null
  }
  return expiry
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockoutExpiry, setLockoutExpiry] = useState<number | null>(null)
  const [countdown, setCountdown] = useState('')

  // On mount, restore lockout state from localStorage
  useEffect(() => {
    const storedAttempts = getStoredAttempts()
    const storedLockout = getStoredLockout()
    setAttempts(storedAttempts)
    setLockoutExpiry(storedLockout)
  }, [])

  // Countdown timer during lockout
  useEffect(() => {
    if (!lockoutExpiry) {
      setCountdown('')
      return
    }

    function tick() {
      const remaining = lockoutExpiry! - Date.now()
      if (remaining <= 0) {
        setLockoutExpiry(null)
        setAttempts(0)
        setCountdown('')
        localStorage.removeItem(STORAGE_KEY_LOCKOUT)
        localStorage.removeItem(STORAGE_KEY_ATTEMPTS)
        setError('')
        return
      }
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lockoutExpiry])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Check lockout
    const currentLockout = getStoredLockout()
    if (currentLockout) {
      setLockoutExpiry(currentLockout)
      return
    }

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        localStorage.setItem(STORAGE_KEY_ATTEMPTS, String(newAttempts))

        if (newAttempts >= MAX_ATTEMPTS) {
          const expiry = Date.now() + LOCKOUT_DURATION_MS
          setLockoutExpiry(expiry)
          localStorage.setItem(STORAGE_KEY_LOCKOUT, String(expiry))
          setError('')
        } else {
          setError('Invalid email or password.')
        }
        return
      }

      // Success — clear lockout state and navigate
      localStorage.removeItem(STORAGE_KEY_ATTEMPTS)
      localStorage.removeItem(STORAGE_KEY_LOCKOUT)
      router.push('/')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [email, password, attempts, supabase, router])

  const isLockedOut = !!lockoutExpiry

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--color-paper)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 340 }}>
        {/* Monogram */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-charcoal)',
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-paper)',
                letterSpacing: '0.02em',
              }}
            >
              ES
            </span>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--color-ink)',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            THE ELEVATED STAG
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--color-ink-muted)',
            }}
          >
            Client Management
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <input
              className="es-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={isLockedOut || loading}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <input
              className="es-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLockedOut || loading}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--color-ink-secondary)',
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLockedOut || loading}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: 'var(--color-charcoal)',
                  cursor: 'pointer',
                }}
              />
              Remember me
            </label>
          </div>

          <button
            type="submit"
            className="es-btn es-btn-primary"
            disabled={isLockedOut || loading}
            style={{
              width: '100%',
              height: 48,
              opacity: isLockedOut || loading ? 0.5 : 1,
              cursor: isLockedOut || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Error / Lockout messages */}
        <div
          style={{
            minHeight: 20,
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          {isLockedOut && countdown && (
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--color-error)',
              }}
            >
              Too many attempts. Try again in {countdown}
            </p>
          )}
          {!isLockedOut && error && (
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--color-error)',
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
