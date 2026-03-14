import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, Terminal, AlertCircle, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import { cn } from '@/lib/utils'
import { k8sClient } from '@/api/client'

interface K8sVersionResponse {
  major: string
  minor: string
  gitVersion: string
}

export const LoginPage: React.FC = () => {
  const [clusterUrl, setClusterUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { setCredentials } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clusterUrl.trim()) {
      setError('Cluster API URL is required')
      return
    }
    setIsLoading(true)
    setError('')
    setCredentials(clusterUrl.trim(), token.trim())
    try {
      await k8sClient<K8sVersionResponse>('/version')
      navigate('/capps')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to the cluster'
      setError(message)
      useAuthStore.getState().logout()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background overflow-hidden">
      {/* Animated grid background */}
      <AnimatedGridPattern
        numSquares={30}
        maxOpacity={0.08}
        duration={3}
        className={cn(
          'absolute inset-0 h-full w-full',
          '[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]'
        )}
      />

      {/* Subtle glow behind card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-2xl shadow-primary/40 mb-4">
            <Zap size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-text">Capp Console</h1>
          <p className="mt-1 text-sm text-text-muted">Manage containerized workloads</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/50">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clusterUrl" className="text-text-secondary">
                Cluster API URL <span className="text-danger">*</span>
              </Label>
              <Input
                id="clusterUrl"
                type="url"
                value={clusterUrl}
                onChange={(e) => setClusterUrl(e.target.value)}
                placeholder="https://api.cluster.example.com:6443"
                autoComplete="url"
                className="bg-surface border-border"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="token" className="text-text-secondary">
                Bearer Token
              </Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="eyJhbGciOiJSUzI1NiIs..."
                  autoComplete="current-password"
                  className="bg-surface border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              className="w-full mt-1"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…</>
              ) : 'Connect'}
            </Button>
          </form>
        </div>

        {/* kubectl proxy tip */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex gap-2">
            <Terminal size={14} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-xs font-medium text-text-secondary">Local cluster tip</p>
              <p className="mt-1 text-xs text-text-muted">
                For local clusters, use{' '}
                <code className="rounded bg-card px-1 py-0.5 font-mono text-accent">
                  kubectl proxy --port=8001
                </code>{' '}
                and connect to{' '}
                <code className="rounded bg-card px-1 py-0.5 font-mono text-accent">
                  http://localhost:8001
                </code>{' '}
                — no token required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
