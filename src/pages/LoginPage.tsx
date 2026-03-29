import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Zap, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import { cn } from '@/lib/utils'
import { fetchClusters } from '@/api/clusters'
import { getBackendUrl } from '@/lib/config'

type AuthMode = 'detecting' | 'dex' | 'openshift' | 'passthrough'

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
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
      const res = await fetch(`${base}/api/v1/auth/openshift/authorize`, {
        headers: { Accept: 'application/json', ...devHeaders },
      })
      if (res.ok) {
        const data = await res.json() as { authorizeUrl: string }
        setAuthorizeUrl(data.authorizeUrl)
        setAuthMode('openshift')
      } else {
        setAuthMode('dex')
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
        const res = await fetch(`${base}/api/v1/auth/openshift/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...devHeaders },
          body: JSON.stringify({ code }),
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
        await finishLogin(accessToken, refreshToken)
      } catch (err) {
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

  const handleOpenShiftLogin = () => {
    window.location.href = authorizeUrl
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
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background overflow-hidden">
      <AnimatedGridPattern
        numSquares={30}
        maxOpacity={0.08}
        duration={3}
        className={cn(
          'absolute inset-0 h-full w-full',
          '[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]'
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-2xl shadow-primary/40 mb-4">
            <Zap size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-text">Capp Console</h1>
          <p className="mt-1 text-sm text-text-muted">Manage containerized workloads</p>
        </div>

        {authMode === 'detecting' ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/50">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {authMode === 'openshift' ? (
              <Button
                type="button"
                variant="primary"
                disabled={isLoading}
                className="w-full"
                onClick={handleOpenShiftLogin}
              >
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</>
                ) : 'Sign in with OpenShift'}
              </Button>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username" className="text-text-secondary">
                    Username <span className="text-danger">*</span>
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    className="bg-surface border-border"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password" className="text-text-secondary">
                    Password <span className="text-danger">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="bg-surface border-border pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <Button type="submit" variant="primary" disabled={isLoading} className="w-full mt-1">
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</>
                  ) : 'Sign In'}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
