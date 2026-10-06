import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground",
        secondary:
          "border-border bg-surface text-text-secondary",
        destructive:
          "border-danger bg-danger text-primary-foreground",
        outline:    "border-text/35 text-text",
        success:    "bg-success/10 border-success/30 text-success",
        warning:    "bg-warning/10 border-warning/30 text-warning",
        info:       "bg-transparent border-primary/40 text-primary",
        namespace:  "bg-transparent border-border text-text-secondary font-mono",
        danger:     "bg-danger/10 border-danger/30 text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
