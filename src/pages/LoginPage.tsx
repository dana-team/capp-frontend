import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EyeIcon, WarningCircleIcon, CircleNotchIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
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
  const { dark } = useThemeStore()
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
          const data = await authRes.json() as { authorizeUrl: string }
          if (!data.authorizeUrl) {
            throw new Error('OpenShift authorize URL is missing')
          }
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

  const sky0   = dark ? 'hsl(220 18% 11%)' : 'hsl(38 57% 87%)'
  const sky1   = dark ? 'hsl(220 16% 9%)'  : 'hsl(41 50% 82%)'
  const w1a    = dark ? 'hsl(19 50% 20%)'  : 'hsl(19 61% 49%)'
  const w1b    = dark ? 'hsl(19 55% 12%)'  : 'hsl(19 65% 30%)'
  const w2a    = dark ? 'hsl(22 45% 17%)'  : 'hsl(22 60% 42%)'
  const w2b    = dark ? 'hsl(22 50% 9%)'   : 'hsl(22 62% 24%)'
  const w3a    = dark ? 'hsl(15 40% 14%)'  : 'hsl(15 58% 38%)'
  const w3b    = dark ? 'hsl(15 45% 7%)'   : 'hsl(15 60% 22%)'
  const floor  = dark ? 'hsl(220 18% 14%)' : 'hsl(19 55% 28%)'

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden"
         style={{ background: sky1 }}>
      {/* Canyon silhouette SVG background */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sky0} />
            <stop offset="100%" stopColor={sky1} />
          </linearGradient>
          <linearGradient id="wall1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={w1a} stopOpacity="0.55" />
            <stop offset="100%" stopColor={w1b} stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="wall2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={w2a} stopOpacity="0.4" />
            <stop offset="100%" stopColor={w2b} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="wall3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={w3a} stopOpacity="0.3" />
            <stop offset="100%" stopColor={w3b} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(#sky)" />
        {/* Far right wall */}
        <path d="M820,0 L1200,0 L1200,800 L950,800 L920,650 L970,500 L940,340 L990,200 L820,0 Z" fill="url(#wall3)" />
        {/* Left wall */}
        <path d="M0,0 L340,0 L300,130 L360,280 L320,460 L390,600 L280,800 L0,800 Z" fill="url(#wall1)" />
        {/* Closer right wall */}
        <path d="M1020,0 L1200,0 L1200,800 L1080,800 L1050,570 L1100,400 L1060,220 L1020,0 Z" fill="url(#wall2)" />
        {/* Floor hint */}
        <path d="M0,740 Q300,720 600,730 Q900,740 1200,725 L1200,800 L0,800 Z" fill={floor} opacity="0.25" />
      </svg>

      {/* Login card */}
      <div className="relative z-10 w-[320px] border border-border p-8"
           style={{ background: 'hsl(var(--background))', boxShadow: '0 8px 32px rgba(80,30,10,0.22)' }}>

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="font-display font-extrabold text-2xl text-text tracking-tight">RCS</div>
          <div className="text-[9px] tracking-[2.5px] text-text-muted mt-0.5 uppercase">Run Container Service</div>
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
                className="flex items-center justify-center h-9 border border-primary text-primary text-sm font-semibold hover:bg-primary/[0.08] transition-colors"
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
      </div>
    </div>
  )
}
