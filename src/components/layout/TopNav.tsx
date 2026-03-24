import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Zap, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useNamespaces } from '@/hooks/useNamespaces'
import { useClusters } from '@/hooks/useClusters'
import { useNamespaceContext } from '@/context/NamespaceContext'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export const TopNav: React.FC = () => {
  const { cluster, logout, setCredentials, backendUrl, token } = useAuthStore()
  const navigate = useNavigate()
  const { selectedNamespace, setSelectedNamespace } = useNamespaceContext()
  const { data: namespaces } = useNamespaces()
  const { data: clusters } = useClusters()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleClusterChange = (name: string) => {
    setCredentials(backendUrl, name, token)
    // Reset namespace selection when switching clusters
    setSelectedNamespace(undefined)
  }

  const currentCluster = clusters?.find((c) => c.name === cluster)

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border bg-surface px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30">
          <Zap size={14} className="text-primary-foreground" />
        </div>
        <span className="font-semibold text-text text-sm tracking-tight">Capp Console</span>
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Nav links */}
      <nav className="flex items-center gap-1">
        <NavLink
          to="/capps"
          className={({ isActive }) =>
            cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 border border-primary/20 text-primary'
                : 'text-text-secondary hover:text-text hover:bg-card'
            )
          }
        >
          Capps
        </NavLink>
      </nav>

      <div className="flex-1" />

      {/* Cluster selector */}
      {clusters && clusters.length > 1 ? (
        <Select value={cluster} onValueChange={handleClusterChange}>
          <SelectTrigger className="h-8 w-44 text-xs bg-card border-border">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                'relative inline-flex h-2 w-2 shrink-0 rounded-full',
                currentCluster?.healthy !== false ? 'bg-success' : 'bg-danger'
              )} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {clusters.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'relative inline-flex h-2 w-2 shrink-0 rounded-full',
                    c.healthy ? 'bg-success' : 'bg-danger'
                  )} />
                  {c.displayName || c.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        /* Single cluster — show as a static badge */
        <div className="flex items-center gap-2 rounded-md bg-card border border-border px-3 py-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            {currentCluster?.healthy !== false && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            )}
            <span className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              currentCluster?.healthy !== false ? 'bg-success' : 'bg-danger'
            )} />
          </span>
          <span className="text-xs text-text-muted truncate max-w-[160px]" title={cluster}>
            {currentCluster?.displayName || cluster}
          </span>
        </div>
      )}

      {/* Namespace selector */}
      <Select
        value={selectedNamespace ?? '__all__'}
        onValueChange={(v) => setSelectedNamespace(v === '__all__' ? undefined : v)}
      >
        <SelectTrigger className="h-8 w-44 text-xs bg-card border-border">
          <SelectValue placeholder="All Namespaces" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Namespaces</SelectItem>
          {(namespaces ?? []).map((ns) => (
            <SelectItem key={ns.name} value={ns.name}>
              {ns.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-text-muted hover:text-danger h-8"
      >
        <LogOut size={14} className="mr-1.5" />
        Disconnect
      </Button>
    </header>
  )
}
