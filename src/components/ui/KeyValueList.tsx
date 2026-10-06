import React from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface KeyValuePair {
  key: string;
  value: string;
}

interface KeyValueListProps {
  label?: string;
  value: KeyValuePair[];
  onChange: (value: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  className?: string;
}

export const KeyValueList: React.FC<KeyValueListProps> = ({
  label,
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  className,
}) => {
  const addItem = () => {
    onChange([...value, { key: '', value: '' }]);
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'key' | 'value', newVal: string) => {
    const updated = value.map((item, i) =>
      i === index ? { ...item, [field]: newVal } : item
    );
    onChange(updated);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label className="font-sans text-sm font-medium text-text-secondary">{label}</label>
      )}
      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={item.key}
                onChange={(e) => updateItem(index, 'key', e.target.value)}
                placeholder={keyPlaceholder}
                className="flex-1 h-8 rounded border border-border bg-card px-3 font-mono text-xs text-text placeholder:font-sans placeholder:text-sm placeholder:text-text-muted hover:border-text/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              />
              <input
                value={item.value}
                onChange={(e) => updateItem(index, 'value', e.target.value)}
                placeholder={valuePlaceholder}
                className="flex-1 h-8 rounded border border-border bg-card px-3 font-mono text-xs text-text placeholder:font-sans placeholder:text-sm placeholder:text-text-muted hover:border-text/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
      >
        <Plus size={14} />
        Add entry
      </button>
    </div>
  );
};
