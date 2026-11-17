import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { useNamespaceContext } from '@/context/NamespaceContext'
import { useCfuncFeatures, useFunctions, usePools } from '@/hooks/useCfunc'
import { cn } from '@/lib/utils'
import { BetaTag } from './BetaTag'

export type CfuncView = 'functions' | 'pools'

const VIEWS: { view: CfuncView; to: string; label: string }[] = [
  { view: 'functions', to: '/functions', label: 'Functions' },
  { view: 'pools', to: '/pools', label: 'Pools' },
]

/**
 * Header of the one Functions tab: both create actions, and the switch between
 * its two lists. Each list keeps its own URL, so a view can be linked to.
 */
export const CfuncHeader: React.FC<{ view: CfuncView }> = ({ view }) => {
  const navigate = useNavigate()
  const { selectedNamespace } = useNamespaceContext()
  const features = useCfuncFeatures()
  const { data: functions } = useFunctions(selectedNamespace, features.functions)
  const { data: pools } = usePools(selectedNamespace)
  const counts: Record<CfuncView, number | undefined> = { functions: functions?.length, pools: pools?.length }
  // Functions can be off in the backend while Pools are on.
  const views = VIEWS.filter((v) => v.view === 'pools' || features.functions)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Functions"
        badge={<BetaTag />}
        description={selectedNamespace ? `Namespace ${selectedNamespace}` : 'All namespaces'}
        actions={
          <>
            <Button variant={features.functions ? 'secondary' : 'primary'} onClick={() => navigate('/pools/new')}>
              <PlusIcon size={14} />
              Create Pool
            </Button>
            {features.functions && (
              <Button variant="primary" onClick={() => navigate('/functions/new')}>
                <PlusIcon size={14} />
                Create Function
              </Button>
            )}
          </>
        }
      />

      {views.length > 1 && (
        <nav aria-label="Functions views" className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
          {views.map((v) => {
            const active = v.view === view
            return (
              <Link
                key={v.view}
                to={v.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text',
                )}
              >
                {v.label}
                {counts[v.view] !== undefined && (
                  <span className="text-xs tabular-nums opacity-70">{counts[v.view]}</span>
                )}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
