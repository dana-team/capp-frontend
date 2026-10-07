import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
  hint?: string
}

const Input = ({ className, type, label, error, hint, required, id, ref, ...props }: InputProps) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  const inputEl = (
    <input
      type={type}
      id={inputId}
      className={cn(
        "flex h-9 w-full rounded border bg-card px-3 text-sm text-text placeholder:text-text-muted",
        "transition-colors duration-150 outline-none",
        "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-danger focus:border-danger focus:ring-danger" : "border-border hover:border-text/40",
        className
      )}
      ref={ref}
      required={required}
      {...props}
    />
  )

  if (!label && !error && !hint) {
    return inputEl
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="font-sans text-sm font-medium text-text-secondary"
        >
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      {inputEl}
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  )
}

export { Input }
