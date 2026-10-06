import React, { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  SignOutIcon, ShippingContainerIcon,
  BookOpenTextIcon, KeyIcon,
  GearSixIcon, DotsThreeIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useNamespaces } from '@/hooks/useNamespaces'
import { useClusters } from '@/hooks/useClusters'
import { useNamespaceContext } from '@/context/NamespaceContext'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { NamespaceQuotaBar } from './NamespaceQuotaBar'
import { CreateNamespaceDialog } from '@/components/namespace/CreateNamespaceDialog'
import { NamespaceSettingsDialog } from '@/components/namespace/NamespaceSettingsDialog'

const navItems = [
  { to: '/capps',      label: 'Capps',      Icon: ShippingContainerIcon },
  { to: '/secrets',    label: 'Secrets',    Icon: KeyIcon },
  { to: '/configmaps', label: 'ConfigMaps', Icon: BookOpenTextIcon },
]

const Seal: React.FC = () => (
  <span
    aria-hidden="true"
    className="relative inline-flex h-7 w-7 shrink-0 -rotate-2 items-center justify-center rounded-[2px] bg-primary text-primary-foreground"
  >
    <span className="absolute inset-[2px] rounded-[1px] border border-primary-foreground/45" />
    <span className="relative font-sans text-[9.5px] font-extrabold leading-none tracking-[0.02em]">RCS</span>
  </span>
)

/** Irregular brush stroke laid under the active link; shared layoutId makes it glide. */
const BrushMarker: React.FC = () => (
  <motion.span
    layoutId="nav-brush"
    aria-hidden="true"
    className="pointer-events-none absolute -bottom-[3px] left-2.5 right-2.5 h-[5px] text-primary"
    transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }}
  >
    <svg viewBox="0 0 60 5" className="h-full w-full" preserveAspectRatio="none">
      <path
        d="M0.5 3.1 C6 1.2 10 3.9 17 2.4 C24 0.9 28 3.8 36 2.3 C44 0.8 50 3.6 59.5 2 C58.2 3.4 59 4.2 57 4.4 C49 4.9 44 3.4 36 4.2 C28 5 23 3.6 16 4.3 C9 4.9 5 3.4 0.5 3.1 Z"
        fill="currentColor"
      />
    </svg>
  </motion.span>
)

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-sans text-[12px] font-medium leading-none tracking-[0.01em] text-text-secondary">{children}</span>
)

const triggerCls = 'h-8 text-xs font-mono bg-transparent border-border'

/**
 * Closes on outside pointer-down / Escape. Popovers the panel opens itself
 * (e.g. its select menus, portaled to <body>) are marked with
 * PANEL_LAYER_ATTR so clicks inside them count as inside the panel.
 */
const PANEL_LAYER_ATTR = 'data-topbar-layer'
const panelLayer = { [PANEL_LAYER_ATTR]: '' }

function usePanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (ref.current?.contains(t)) return
      if (t?.closest?.(`[${PANEL_LAYER_ATTR}]`)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, ref }
}

function useWide() {
  const query = '(min-width: 1100px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

const iconBtn = 'inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-text-secondary transition-colors duration-150 hover:border-border hover:text-text'
const panelCls = 'absolute right-0 top-full z-30 mt-3 w-64 rounded-[10px] border border-border bg-card p-3 shadow-[0_18px_50px_-18px_hsl(var(--text)/0.35)]'

export const TopBar: React.FC = () => {
  const { cluster, logout, setCredentials, token, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const { selectedNamespace, setSelectedNamespace } = useNamespaceContext()

  const { data: namespaces } = useNamespaces()
  const { data: clusters } = useClusters()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  const wide = useWide()
  const more = usePanel()

  const canCreate = namespaces?.canCreate ?? false
  const currentCluster = clusters?.find((c) => c.name === cluster)
  const selectedNsItem = namespaces?.items?.find((ns) => ns.name === selectedNamespace)

  const handleLogout = () => { logout(); navigate('/login') }
  const handleClusterChange = (name: string) => {
    setCredentials(name, token, refreshToken)
    setSelectedNamespace(undefined)
  }

  const namespaceSelect = (
    <Select
      value={selectedNamespace ?? '__all__'}
      onValueChange={(v) => {
        if (v === '__create__') { setCreateDialogOpen(true); return }
        setSelectedNamespace(v === '__all__' ? undefined : v)
      }}
    >
      <SelectTrigger aria-label="Namespace" className={cn(triggerCls, wide ? 'w-[150px]' : 'w-full')}>
        <SelectValue placeholder="All Namespaces" />
      </SelectTrigger>
      <SelectContent {...panelLayer}>
        <SelectItem value="__all__">All Namespaces</SelectItem>
        {(namespaces?.items ?? []).map((ns) => (
          <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
        ))}
        {canCreate && (
          <SelectItem value="__create__">+ Create Namespace</SelectItem>
        )}
      </SelectContent>
    </Select>
  )

  const settingsButton = selectedNsItem?.canEdit && (
    <button
      onClick={() => setSettingsDialogOpen(true)}
      aria-label="Namespace settings"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted transition-colors duration-150 hover:text-primary"
    >
      <GearSixIcon size={13} weight="bold" />
    </button>
  )

  const clusterControl = clusters && clusters.length > 1 ? (
    <Select value={cluster} onValueChange={handleClusterChange}>
      <SelectTrigger aria-label="Cluster" className={cn(triggerCls, 'w-full')}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn(
            'relative inline-flex h-2 w-2 shrink-0 rounded-full',
            currentCluster?.healthy !== false ? 'bg-success' : 'bg-danger'
          )} />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent {...panelLayer}>
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
    <div className={cn(
      'flex h-8 items-center gap-2 rounded-[3px] border border-border px-2 text-xs font-mono text-text-muted',
      'w-full'
    )}>
      <span className="relative flex h-2 w-2 shrink-0">
        {currentCluster?.healthy !== false && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        )}
        <span className={cn(
          'relative inline-flex h-2 w-2 rounded-full',
          currentCluster?.healthy !== false ? 'bg-success' : 'bg-danger'
        )} />
      </span>
      <span className="truncate">{currentCluster?.displayName || cluster}</span>
    </div>
  )

  const disconnect = (
    <button
      onClick={handleLogout}
      className="group flex w-full items-center gap-1.5 text-xs text-text-muted transition-colors duration-150 hover:text-primary"
    >
      <SignOutIcon size={13} className="transition-transform duration-150 group-hover:translate-x-[-1px]" />
      Disconnect
    </button>
  )

  const quota = selectedNsItem?.quota

  return (
    <header className="fixed left-1/2 top-4 z-20 flex h-14 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-5 rounded-full border border-border bg-card px-5 shadow-[0_10px_30px_-14px_hsl(var(--text)/0.35)]">
      {/* Brand */}
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <Seal />
        <span className="font-sans text-[13px] font-semibold leading-[1.1] text-text">
          {wide ? <>Run Container<br />Service</> : <span className="hidden sm:inline">Run Container Service</span>}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-0.5" aria-label="Primary">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) => cn(
              'group relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] transition-colors duration-150',
              isActive ? 'font-medium text-text' : 'text-text-secondary hover:text-text'
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && <BrushMarker />}
                <Icon
                  size={14}
                  weight="light"
                  className={cn(
                    'shrink-0 transition-colors duration-150',
                    isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary'
                  )}
                />
                <span className={cn(!wide && 'hidden md:inline')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-2">
        {wide && (
          <>
            {namespaceSelect}
            {settingsButton}
          </>
        )}
        <ThemeToggle size={14} />
        <div ref={more.ref} className="relative">
          <button
            type="button"
            onClick={() => more.setOpen((o) => !o)}
            aria-label="More"
            aria-expanded={more.open}
            className={iconBtn}
          >
            <DotsThreeIcon size={18} weight="bold" />
          </button>
          {more.open && (
            <div className={cn(panelCls, 'flex flex-col gap-3')}>
              {!wide && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Namespace</SectionLabel>
                    {settingsButton}
                  </div>
                  {namespaceSelect}
                </div>
              )}
              {quota && <NamespaceQuotaBar quota={quota} />}
              <div className="flex flex-col gap-1.5">
                <SectionLabel>Cluster</SectionLabel>
                {clusterControl}
              </div>
              <div className="border-t border-border-subtle" />
              {disconnect}
            </div>
          )}
        </div>
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
    </header>
  )
}
