import React from 'react';
import { Cube } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-center',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded border border-border bg-surface">
        {icon ?? <Cube size={28} weight="light" className="text-text-secondary" />}
      </div>
      <div>
        <p className="font-display text-xl font-medium tracking-tight text-text">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-text-muted max-w-sm">{description}</p>
        )}
      </div>
      {action && (
        <Button
          variant="primary"
          size="sm"
          onClick={action.onClick}
          icon={action.icon}
          className="mt-1"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};
