import React from 'react';
import { Package } from 'lucide-react';
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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-subtle border border-primary/20">
        {icon ?? <Package size={28} className="text-primary" />}
      </div>
      <div>
        <p className="text-base font-semibold text-text">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-text-muted max-w-xs">{description}</p>
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
