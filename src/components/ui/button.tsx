import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleNotch } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "border border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "border border-danger bg-danger text-primary-foreground hover:bg-danger/90",
        outline:     "border border-text/35 bg-transparent text-text hover:border-text hover:bg-surface",
        secondary:   "border border-border bg-surface text-text hover:border-text/50",
        ghost:       "border border-transparent text-text-secondary hover:bg-surface hover:text-text",
        link:        "text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary",
        primary:     "border border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        danger:      "border border-danger/50 bg-transparent text-danger hover:bg-danger hover:text-primary-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 px-3",
        lg:      "h-10 px-8",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  loading,
  icon,
  iconPosition = 'left',
  disabled,
  children,
  ref,
  ...props
}: ButtonProps) => {
  const isDisabled = disabled || loading
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      ref={ref as React.Ref<HTMLButtonElement>}
      disabled={isDisabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <CircleNotch className="h-4 w-4 animate-spin" />}
      {!loading && icon && iconPosition !== 'right' && <span className="shrink-0">{icon}</span>}
      {children}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </Comp>
  )
}

export { Button, buttonVariants }
