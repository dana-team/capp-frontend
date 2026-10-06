import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EyeIcon, WarningCircleIcon, CircleNotchIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { useAuthStore } from '@/store/auth'
import { motion } from 'motion/react'
import { InkLandscape } from '@/components/landscape/InkLandscape'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { fetchClusters } from '@/api/clusters'
import { getBackendUrl } from '@/lib/config'

type AuthMode = 'detecting' | 'dex' | 'openshift' | 'passthrough' | 'jwt'

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [cluster, setCluster] = useState('local')
  const [showPassword, setShowPassword] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('detecting')
  const [authorizeUrl, setAuthorizeUrl] = useState('')

  const { setCredentials } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const backendUrl = getBackendUrl()
  const base = import.meta.env.DEV ? '' : backendUrl.replace(/\/$/, '')
  const devHeaders: Record<string, string> = import.meta.env.DEV
    ? { 'X-Backend-Url': backendUrl.replace(/\/$/, '') }
    : {}

  const finishLogin = async (accessToken: string, refreshToken: string) => {
    const clusters = await fetchClusters(accessToken)
    if (clusters.length === 0) {
      throw new Error('No clusters configured on this backend')
    }
    const defaultCluster = clusters.find((c) => c.healthy) ?? clusters[0]
    setCredentials(defaultCluster.name, accessToken, refreshToken)
    navigate('/capps')
  }

  const detectAuthMode = async () => {
    try {
      const res = await fetch(`${base}/api/v1/auth/mode`, {
        headers: { Accept: 'application/json', ...devHeaders },
      })
      if (!res.ok) { setAuthMode('dex'); return }
      const { mode } = await res.json() as { mode: string }

      if (mode === 'openshift') {
        try {
          const authRes = await fetch(`${base}/api/v1/auth/openshift/authorize`, {
            headers: { Accept: 'application/json', ...devHeaders },
          })
         if (!authRes.ok) {
            throw new Error('Failed to get OpenShift authorize URL')
          }
          const data = await authRes.json() as { authorizeUrl: string; state?: string }
          if (!data.authorizeUrl) {
            throw new Error('OpenShift authorize URL is missing')
          }
          try {
            if (data.state) {
              sessionStorage.setItem('openshift_oauth_state', data.state)
            } else {
              sessionStorage.removeItem('openshift_oauth_state')
            }
          } catch { /* sessionStorage unavailable (private mode) — proceed without CSRF state */ }
          setAuthorizeUrl(data.authorizeUrl)
          setAuthMode('openshift')
          return
        } catch {
          setError('Failed to initialize OpenShift authentication, falling back to standard login.')
          setAuthMode('dex')
          return
        }
      } else if (mode === 'dex') {
        setAuthMode('dex')
      } else if (mode === 'jwt' || mode === 'static') {
        setAuthMode('jwt')
      } else {
        // passthrough: token is used directly, no login endpoint
        setAuthMode('passthrough')
      }
    } catch {
      setAuthMode('dex')
    }
  }

  // Effect 1: handle ?code= OAuth callback from OpenShift redirect
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) return

    setIsLoading(true)
    setError('')
    ;(async () => {
      try {
        let storedState = ''
        try { storedState = sessionStorage.getItem('openshift_oauth_state') ?? '' } catch { /* unavailable */ }
        const urlState = searchParams.get('state') ?? ''
        const state = storedState || urlState

        const res = await fetch(`${base}/api/v1/auth/openshift/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...devHeaders },
          body: JSON.stringify({ code, state }),
        })
        if (!res.ok) {
          let message = 'OAuth authentication failed'
          try {
            const data = await res.json() as { error?: { message?: string } }
            message = data.error?.message ?? message
          } catch { /* ignore */ }
          throw new Error(message)
        }
        const { accessToken, refreshToken } = await res.json() as {
          accessToken: string
          refreshToken: string
        }
        try { sessionStorage.removeItem('openshift_oauth_state') } catch { /* unavailable */ }
        await finishLogin(accessToken, refreshToken)
      } catch (err) {
        try { sessionStorage.removeItem('openshift_oauth_state') } catch { /* unavailable */ }
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setIsLoading(false)
        // Clear the code from the URL so the user can retry
        navigate('/login', { replace: true })
        // Effect 2 skipped its probe because ?code was present, so run it now.
        await detectAuthMode()
      }
    })()
  }, []) 

  // Effect 2: detect auth mode by probing the openshift authorize endpoint
  useEffect(() => {
    if (searchParams.get('code')) return // Effect 1 handles this case and calls detectAuthMode on failure
    detectAuthMode()
  }, [])

  // passthrough mode: token is used directly as a k8s bearer token, no login endpoint
  const handlePassthroughSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) { setError('Token is required'); return }
    setIsLoading(true)
    setError('')
    try {
      await finishLogin(token.trim(), '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  // jwt/static mode: exchange cluster + token for a session JWT
  const handleJwtSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cluster.trim()) { setError('Cluster is required'); return }
    if (!token.trim()) { setError('Token is required'); return }
    setIsLoading(true)
    setError('')
    try {
      const loginRes = await fetch(`${base}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...devHeaders },
        body: JSON.stringify({ cluster: cluster.trim(), token: token.trim() }),
      })
      if (!loginRes.ok) {
        let message = 'Invalid credentials'
        try {
          const data = await loginRes.json() as { error?: { message?: string }; message?: string }
          message = data.error?.message ?? data.message ?? message
        } catch { /* ignore */ }
        throw new Error(message)
      }
      const { accessToken, refreshToken } = await loginRes.json() as {
        accessToken: string
        refreshToken: string
      }
      await finishLogin(accessToken, refreshToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) { setError('Username is required'); return }
    if (!password) { setError('Password is required'); return }
    setIsLoading(true)
    setError('')
    try {
      const loginRes = await fetch(`${base}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...devHeaders },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (!loginRes.ok) {
        let message = 'Invalid credentials'
        try {
          const data = await loginRes.json() as { error?: { message?: string }; message?: string }
          message = data.error?.message ?? data.message ?? message
        } catch { /* ignore */ }
        throw new Error(message)
      }
      const { accessToken, refreshToken } = await loginRes.json() as {
        accessToken: string
        refreshToken: string
      }
      await finishLogin(accessToken, refreshToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <InkLandscape variant="stage" station={0} />

      <ThemeToggle size={16} className="absolute right-4 top-4 z-10 border-border bg-card sm:right-6 sm:top-6" />

      <div className="relative z-[1] flex min-h-screen items-center justify-center px-4 py-10 lg:justify-start lg:pl-[10vw]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[340px] rounded-[3px] border border-border bg-card p-8 shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]"
        >

        {/* Logo */}
        <div className="mb-8 flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="relative inline-flex h-11 w-11 shrink-0 -rotate-2 items-center justify-center rounded-[2px] bg-primary text-primary-foreground"
          >
            <span className="absolute inset-[3px] rounded-[1px] border border-primary-foreground/45" />
            <span className="relative font-sans text-[15px] font-extrabold leading-none tracking-[0.02em]">RCS</span>
          </span>
          <div>
            <h1 className="font-display text-[26px] font-medium leading-none tracking-[-0.02em] text-text">RCS</h1>
            <p className="mt-1.5 font-sans text-[13px] font-medium leading-none tracking-[0.01em] text-text-secondary">Run Container Service</p>
          </div>
        </div>

        {authMode === 'detecting' && (
          <div className="flex justify-center py-4">
            <CircleNotchIcon size={20} className="animate-spin text-text-muted" />
          </div>
        )}

        {authMode === 'openshift' && (
          <div className="flex flex-col gap-2">
            {authorizeUrl && (
              <a
                href={authorizeUrl}
                className="flex items-center justify-center h-9 rounded-[3px] border border-primary text-primary text-sm font-medium hover:bg-primary/[0.08] transition-colors"
              >
                OpenShift OAuth
              </a>
            )}
            {error && (
              <Alert variant="destructive">
                <WarningCircleIcon size={14} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {authMode === 'dex' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 bottom-2 text-text-muted hover:text-text"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeSlashIcon size={15} /> : <EyeIcon size={15} />}
              </button>
            </div>
            {error && (
              <Alert variant="destructive">
                <WarningCircleIcon size={14} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" variant="default" loading={isLoading} className="w-full mt-1">
              Continue →
            </Button>
          </form>
        )}

        {authMode === 'passthrough' && (
          <form onSubmit={handlePassthroughSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <Input
                label="Bearer Token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="eyJhbGci..."
                required
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 bottom-2 text-text-muted hover:text-text"
                tabIndex={-1}
              >
                {showToken ? <EyeSlashIcon size={15} /> : <EyeIcon size={15} />}
              </button>
            </div>
            {error && (
              <Alert variant="destructive">
                <WarningCircleIcon size={14} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" variant="default" loading={isLoading} className="w-full mt-1">
              Continue →
            </Button>
          </form>
        )}

        {authMode === 'jwt' && (
          <form onSubmit={handleJwtSubmit} className="flex flex-col gap-3">
            <Input
              label="Cluster"
              value={cluster}
              onChange={(e) => setCluster(e.target.value)}
              required
            />
            <div className="relative">
              <Input
                label="Token"
                type={showPassword ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 bottom-2 text-text-muted hover:text-text"
                tabIndex={-1}
              >
                {showPassword ? <EyeSlashIcon size={15} /> : <EyeIcon size={15} />}
              </button>
            </div>
            {error && (
              <Alert variant="destructive">
                <WarningCircleIcon size={14} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" variant="default" loading={isLoading} className="w-full mt-1">
              Continue →
            </Button>
          </form>
        )}
        </motion.div>
      </div>
    </div>
  )
}
