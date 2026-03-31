import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { SignOut } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useNamespaces } from '@/hooks/useNamespaces'
import { useClusters } from '@/hooks/useClusters'
import { useNamespaceContext } from '@/context/NamespaceContext'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export const Sidebar: React.FC = () => {
  const { cluster, logout, setCredentials, token, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const { selectedNamespace, setSelectedNamespace } = useNamespaceContext()
  const { data: namespaces } = useNamespaces()
  const { data: clusters } = useClusters()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleClusterChange = (name: string) => {
    setCredentials(name, token, refreshToken)
    setSelectedNamespace(undefined)
  }

  const currentCluster = clusters?.find((c) => c.name === cluster)

  return (
    <aside
      className="flex flex-col flex-shrink-0 w-[200px] h-screen bg-surface border-r border-border overflow-y-auto"
      style={{ minHeight: 0 }}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <span className="font-display font-extrabold text-xl text-text tracking-tight">capp</span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col py-2">
        <NavLink
          to="/capps"
          className={({ isActive }) =>
            cn(
              'px-4 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-l-2 border-primary bg-primary/[0.08] text-primary pl-[14px]'
                : 'border-l-2 border-transparent text-text-secondary hover:text-text pl-[14px]'
            )
          }
        >
          Capps
        </NavLink>
      </nav>

      {/* Bottom section */}
      <div className="mt-auto flex flex-col gap-3 px-3 py-4 border-t border-border">
        {/* Namespace selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.8px]">Namespace</span>
          <Select
            value={selectedNamespace ?? '__all__'}
            onValueChange={(v) => setSelectedNamespace(v === '__all__' ? undefined : v)}
          >
            <SelectTrigger className="h-7 text-xs font-mono bg-background border-border w-full">
              <SelectValue placeholder="All Namespaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Namespaces</SelectItem>
              {(namespaces ?? []).map((ns) => (
                <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cluster indicator / selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.8px]">Cluster</span>
          {clusters && clusters.length > 1 ? (
            <Select value={cluster} onValueChange={handleClusterChange}>
              <SelectTrigger className="h-7 text-xs font-mono bg-background border-border w-full">
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
            <div className="flex items-center gap-2 h-7 px-2 border border-border bg-background text-xs font-mono text-text-muted truncate">
              <span className="relative flex h-2 w-2 shrink-0">
                {currentCluster?.healthy !== false && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                )}
                <span className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  currentCluster?.healthy !== false ? 'bg-success' : 'bg-danger'
                )} />
              </span>
              <span className="truncate">{currentCluster?.displayName || cluster}</span>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-danger transition-colors mt-1"
        >
          <SignOut size={13} />
          Disconnect
        </button>
      </div>
    </aside>
  )
}
