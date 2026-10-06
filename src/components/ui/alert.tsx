import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded border border-border border-l-2 border-l-text/50 bg-card p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "text-text",
        destructive:
          "border-danger/40 border-l-danger bg-danger/5 text-danger [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = ({
  className,
  variant,
  ref,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
)

const AlertTitle = ({ className, ref, ...props }: React.ComponentProps<"h5">) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-sans text-sm font-semibold leading-none tracking-tight", className)}
    {...props}
  />
)

const AlertDescription = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
)

export { Alert, AlertTitle, AlertDescription }
