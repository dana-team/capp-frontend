import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { SignOutIcon, ShippingContainerIcon, CactusIcon, BookOpenTextIcon, KeyIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useNamespaces, useCreateNamespace } from '@/hooks/useNamespaces'
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
    const createNamespaceMutation = useCreateNamespace()

    const [isCreatingNs, setIsCreatingNs] = useState(false)
    const [newNamespace, setNewNamespace] = useState('')

    const canCreate = namespaces?.canCreate ?? false
    const currentCluster = clusters?.find((c) => c.name === cluster)

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const handleClusterChange = (name: string) => {
        setCredentials(name, token, refreshToken)
        setSelectedNamespace(undefined)
    }

    const handleCreateNamespace = async () => {
        if (!newNamespace.trim()) return
        try {
            await createNamespaceMutation.mutateAsync(newNamespace)
            setNewNamespace('')
            setIsCreatingNs(false)
            setSelectedNamespace(newNamespace)
        } catch (e) {
            console.error('Failed to create namespace', e)
        }
    }

    const handleCancelCreate = () => {
        setIsCreatingNs(false)
        setNewNamespace('')
        createNamespaceMutation.reset()
    }

    return (
        <aside className="flex flex-col flex-shrink-0 w-[200px] h-screen bg-surface border-r border-border overflow-y-auto">

            {/* Logo */}
            <div className="px-4 py-4 border-b border-border flex items-center justify-between">
                <span className="font-display font-extrabold text-xl text-text tracking-tight">RCS</span>
                <CactusIcon size={25} className="text-primary" />
            </div>

            {/* Nav links */}
            <nav className="flex flex-col py-2">
                <NavLink
                    to="/capps"
                    className={({ isActive }) => cn(
                        'px-4 py-1.5 text-sm font-medium transition-colors pl-[14px] flex items-center justify-between border-l-2',
                        isActive
                            ? 'border-primary bg-primary/[0.08] text-primary'
                            : 'border-transparent text-text-secondary hover:text-text'
                    )}
                >
                    Capps
                    <ShippingContainerIcon size={14} className="text-primary ml-1" />
                </NavLink>

                <NavLink
                    to="/configmaps"
                    className={({ isActive }) => cn(
                        'px-4 py-1.5 text-sm font-medium transition-colors pl-[14px] flex items-center justify-between border-l-2',
                        isActive
                            ? 'border-primary bg-primary/[0.08] text-primary'
                            : 'border-transparent text-text-secondary hover:text-text'
                    )}
                >
                    ConfigMaps
                    <BookOpenTextIcon size={14} className="text-primary ml-1" />
                </NavLink>

                <NavLink
                    to="/secrets"
                    className={({ isActive }) => cn(
                        'px-4 py-1.5 text-sm font-medium transition-colors pl-[14px] flex items-center justify-between border-l-2',
                        isActive
                            ? 'border-primary bg-primary/[0.08] text-primary'
                            : 'border-transparent text-text-secondary hover:text-text'
                    )}
                >
                    Secrets
                    <KeyIcon size={14} className="text-primary ml-1" />
                </NavLink>
            </nav>

            {/* Bottom section */}
            <div className="mt-auto flex flex-col gap-3 px-3 py-4 border-t border-border">

                {/* Namespace */}
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.8px]">
                        Namespace
                    </span>

                    <Select
                        value={selectedNamespace ?? '__all__'}
                        onValueChange={(v) => {
                            if (v === '__create__') {
                                setIsCreatingNs(true)
                                return
                            }
                            setSelectedNamespace(v === '__all__' ? undefined : v)
                        }}
                    >
                        <SelectTrigger className="h-7 text-xs font-mono bg-background border-border w-full">
                            <SelectValue placeholder="All Namespaces" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">All Namespaces</SelectItem>
                            {(namespaces?.items ?? []).map((ns) => (
                                <SelectItem key={ns.name} value={ns.name}>
                                    {ns.name}
                                </SelectItem>
                            ))}
                            {canCreate && (
                                <SelectItem value="__create__">+ Create Namespace</SelectItem>
                            )}
                        </SelectContent>
                    </Select>

                    {/* Create namespace form */}
                    {isCreatingNs && (
                        <div className="flex flex-col gap-1 w-full mt-1">
                            <input
                                autoFocus
                                className="h-7 w-full px-2 text-xs font-mono bg-background border border-border rounded"
                                placeholder="namespace-name"
                                value={newNamespace}
                                onChange={(e) => setNewNamespace(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateNamespace()
                                    if (e.key === 'Escape') handleCancelCreate()
                                }}
                            />
                            <div className="flex gap-1 w-full">
                                <button
                                    className="flex-1 h-7 text-xs bg-primary text-white rounded disabled:opacity-50"
                                    onClick={handleCreateNamespace}
                                    disabled={createNamespaceMutation.isPending || !newNamespace.trim()}
                                >
                                    {createNamespaceMutation.isPending ? 'Creating...' : 'Add'}
                                </button>
                                <button
                                    className="flex-1 h-7 text-xs border border-border text-text-muted rounded hover:bg-muted"
                                    onClick={handleCancelCreate}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {createNamespaceMutation.isError && (
                        <span className="text-xs text-danger mt-1">
                            Failed to create namespace
                        </span>
                    )}
                </div>

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
                    <SignOutIcon size={13} />
                    Disconnect
                </button>
            </div>
        </aside>
    )
}