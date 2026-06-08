import React from 'react';

const SIZE_CONFIG = {
  small:  { label: 'S', title: 'Small',  className: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
  medium: { label: 'M', title: 'Medium', className: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  large:  { label: 'L', title: 'Large',  className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
} as const;

export const SizeBadge: React.FC<{ size?: string }> = ({ size }) => {
  const cfg = size ? SIZE_CONFIG[size as keyof typeof SIZE_CONFIG] : null;
  if (!cfg) return <span className="text-xs text-text-muted font-mono">—</span>;
  return (
    <span
      title={cfg.title}
      className={`inline-flex items-center justify-center h-5 w-5 rounded border text-[10px] font-bold leading-none ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
};
