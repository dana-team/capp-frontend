import React from 'react';

const SIZE_CONFIG = {
  small:  { label: 'S', title: 'Small',  className: 'bg-transparent text-text-secondary border-border' },
  medium: { label: 'M', title: 'Medium', className: 'bg-transparent text-text border-text/40' },
  large:  { label: 'L', title: 'Large',  className: 'bg-primary/10 text-primary border-primary/40' },
} as const;

export const SizeBadge: React.FC<{ size?: string }> = ({ size }) => {
  const cfg = size ? SIZE_CONFIG[size as keyof typeof SIZE_CONFIG] : null;
  if (!cfg) return <span className="text-xs text-text-muted font-mono">—</span>;
  return (
    <span
      title={cfg.title}
      className={`inline-flex items-center justify-center h-5 w-5 rounded border font-mono text-[10px] font-medium leading-none ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
};
