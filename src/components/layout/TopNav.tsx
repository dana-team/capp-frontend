import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Zap, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useNamespaces } from '@/hooks/useNamespaces'
import { useNamespaceContext } from '@/context/NamespaceContext'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export const TopNav: React.FC = () => {
  const { clusterUrl, logout } = useAuthStore()
  const navigate = useNavigate()
  const { selectedNamespace, setSelectedNamespace } = useNamespaceContext()
  const { data: namespaces } = useNamespaces()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const truncateUrl = (url: string) => {
    try {
      const u = new URL(url)
      return u.host.length > 30 ? u.host.slice(0, 30) + '…' : u.host
    } catch {
      return url.length > 30 ? url.slice(0, 30) + '…' : url
    }
  }

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

      {/* Spacer */}
      <div className="flex-1" />

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
            <SelectItem key={ns.metadata.name} value={ns.metadata.name}>
              {ns.metadata.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Cluster status */}
      <div className="flex items-center gap-2 rounded-md bg-card border border-border px-3 py-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <span className="text-xs text-text-muted truncate max-w-[160px]" title={clusterUrl}>
          {truncateUrl(clusterUrl)}
        </span>
      </div>

      {/* Disconnect */}
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
