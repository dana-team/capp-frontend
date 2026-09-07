import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  SignOutIcon, ShippingContainerIcon, CactusIcon,
  BookOpenTextIcon, KeyIcon, SunIcon, MoonIcon,
  GearSixIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { useNamespaces } from '@/hooks/useNamespaces'
import { useClusters } from '@/hooks/useClusters'
import { useNamespaceContext } from '@/context/NamespaceContext'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { NamespaceQuotaBar } from './NamespaceQuotaBar'
import { CreateNamespaceDialog } from '@/components/namespace/CreateNamespaceDialog'
import { NamespaceSettingsDialog } from '@/components/namespace/NamespaceSettingsDialog'

const navItems = [
  { to: '/capps',      label: 'Capps',      Icon: ShippingContainerIcon },
  { to: '/configmaps', label: 'ConfigMaps',  Icon: BookOpenTextIcon },
  { to: '/secrets',    label: 'Secrets',     Icon: KeyIcon },
]

export const Sidebar: React.FC = () => {
  const { cluster, logout, setCredentials, token, refreshToken } = useAuthStore()
  const { dark, toggle: toggleDark } = useThemeStore()
  const navigate = useNavigate()
  const { selectedNamespace, setSelectedNamespace } = useNamespaceContext()

  const { data: namespaces } = useNamespaces()
  const { data: clusters } = useClusters()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  const canCreate = namespaces?.canCreate ?? false
  const currentCluster = clusters?.find((c) => c.name === cluster)
  const selectedNsItem = namespaces?.items?.find((ns) => ns.name === selectedNamespace)

  const handleLogout = () => { logout(); navigate('/login') }
  const handleClusterChange = (name: string) => {
    setCredentials(name, token, refreshToken)
    setSelectedNamespace(undefined)
  }

  return (
    <aside className="flex flex-col flex-shrink-0 w-[200px] h-full bg-surface border-r border-border transition-colors duration-200">

      {/* Branding */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CactusIcon size={20} weight="duotone" className="text-primary shrink-0" />
            <span className="font-display font-bold text-base text-text tracking-tight">RCS</span>
          </div>
          <button
            onClick={toggleDark}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="h-7 w-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-border/40 transition-all duration-150 active:scale-95"
          >
            {dark
              ? <SunIcon size={14} weight="bold" />
              : <MoonIcon size={14} weight="bold" />
            }
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col py-2 gap-0.5 px-2 flex-1 min-h-0 overflow-y-auto">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center justify-between px-3 py-1.5 rounded text-sm font-medium transition-all duration-150 group',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-text-secondary hover:bg-border/30 hover:text-text'
            )}
          >
            {({ isActive }) => (
              <>
                <span className={cn(
                  'transition-all duration-150',
                  isActive ? 'translate-x-0.5' : 'group-hover:translate-x-0.5'
                )}>
                  {label}
                </span>
                <Icon
                  size={13}
                  weight={isActive ? 'bold' : 'regular'}
                  className={cn(
                    'shrink-0 transition-all duration-150',
                    isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary'
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="flex-shrink-0 flex flex-col gap-3 px-3 py-4 border-t border-border overflow-y-auto">

        {/* Namespace */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.8px]">
              Namespace
            </span>
            {selectedNsItem?.canEdit && (
              <button
                onClick={() => setSettingsDialogOpen(true)}
                aria-label="Namespace settings"
                className="h-5 w-5 flex items-center justify-center rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-all duration-150"
              >
                <GearSixIcon size={12} weight="bold" />
              </button>
            )}
          </div>
          <Select
            value={selectedNamespace ?? '__all__'}
            onValueChange={(v) => {
              if (v === '__create__') { setCreateDialogOpen(true); return }
              setSelectedNamespace(v === '__all__' ? undefined : v)
            }}
          >
            <SelectTrigger className="h-7 text-xs font-mono bg-background border-border w-full">
              <SelectValue placeholder="All Namespaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Namespaces</SelectItem>
              {(namespaces?.items ?? []).map((ns) => (
                <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
              ))}
              {canCreate && (
                <SelectItem value="__create__">+ Create Namespace</SelectItem>
              )}
            </SelectContent>
          </Select>

          {selectedNsItem?.quota && <NamespaceQuotaBar quota={selectedNsItem.quota} />}
        </div>

        <CreateNamespaceDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreated={(name) => setSelectedNamespace(name)}
        />
        <NamespaceSettingsDialog
          namespace={selectedNsItem ?? null}
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          isAdmin={canCreate}
        />

        {/* Cluster */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.8px]">
            Cluster
          </span>
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
            <div className="flex items-center gap-2 h-7 px-2 border border-border bg-background rounded text-xs font-mono text-text-muted truncate">
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
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-danger transition-all duration-150 mt-1 group"
        >
          <SignOutIcon size={12} className="group-hover:translate-x-[-1px] transition-transform duration-150" />
          Disconnect
        </button>
      </div>
    </aside>
  )
}
