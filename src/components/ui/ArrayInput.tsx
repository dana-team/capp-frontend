import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArrayInputProps {
  label?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const ArrayInput: React.FC<ArrayInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Add value',
  className,
}) => {
  const [inputValue, setInputValue] = useState('');

  const addItem = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue('');
    }
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label className="text-sm font-medium text-text-secondary">{label}</label>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 rounded-md bg-primary-subtle border border-primary/20 px-2 py-1 text-xs text-primary"
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="hover:text-danger transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 h-8 rounded-lg border border-border bg-card px-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
        />
        <button
          type="button"
          onClick={addItem}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface hover:text-text hover:border-primary/40 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};
