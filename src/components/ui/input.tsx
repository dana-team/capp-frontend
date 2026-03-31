import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
  hint?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, required, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    const inputEl = (
      <input
        type={type}
        id={inputId}
        className={cn(
          "flex h-9 w-full rounded border bg-background px-3 text-sm text-text placeholder:text-text-muted",
          "transition-colors duration-150 outline-none",
          "focus:outline-none focus:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-danger focus:border-danger" : "border-border",
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
            className="text-xs font-medium text-text-secondary"
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
)
Input.displayName = "Input"

export { Input }
