import * as React from "react"

import { cn } from "@/lib/utils"

const Card = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn(
      "rounded border border-border bg-card text-text",
      className
    )}
    {...props}
  />
)

const CardHeader = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
)

const CardTitle = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn("text-base font-semibold leading-none tracking-tight", className)}
    {...props}
  />
)

const CardDescription = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn("text-sm text-text-secondary", className)}
    {...props}
  />
)

const CardContent = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
)

const CardFooter = ({ className, ref, ...props }: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
)

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
