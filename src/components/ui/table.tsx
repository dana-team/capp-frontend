import * as React from "react"

import { cn } from "@/lib/utils"

const Table = ({ className, ref, ...props }: React.ComponentProps<"table">) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
)

const TableHeader = ({ className, ref, ...props }: React.ComponentProps<"thead">) => (
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />
)

const TableBody = ({ className, ref, ...props }: React.ComponentProps<"tbody">) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
)

const TableFooter = ({ className, ref, ...props }: React.ComponentProps<"tfoot">) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-border bg-surface/60 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
)

const TableRow = ({ className, ref, ...props }: React.ComponentProps<"tr">) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border-subtle transition-colors hover:bg-surface/70 data-[state=selected]:bg-surface",
      className
    )}
    {...props}
  />
)

const TableHead = ({ className, ref, ...props }: React.ComponentProps<"th">) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-4 text-left align-middle font-sans text-xs font-semibold uppercase tracking-wider text-text-secondary [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
)

const TableCell = ({ className, ref, ...props }: React.ComponentProps<"td">) => (
  <td
    ref={ref}
    className={cn("px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
)

const TableCaption = ({ className, ref, ...props }: React.ComponentProps<"caption">) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-text-secondary", className)}
    {...props}
  />
)

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
