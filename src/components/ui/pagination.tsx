import * as React from "react"
import { CaretLeft, CaretRight, DotsThree } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/components/ui/button"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
)

const PaginationContent = ({ className, ref, ...props }: React.ComponentProps<"ul">) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
)

const PaginationItem = ({ className, ref, ...props }: React.ComponentProps<"li">) => (
  <li ref={ref} className={cn("", className)} {...props} />
)

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    {...props}
  />
)

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<"button">) => (
  <button
    type="button"
    aria-label="Go to previous page"
    className={cn(buttonVariants({ variant: "ghost", size: "default" }), "gap-1 pl-2.5", className)}
    {...props}
  >
    <CaretLeft className="h-4 w-4" />
    <span>Previous</span>
  </button>
)

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<"button">) => (
  <button
    type="button"
    aria-label="Go to next page"
    className={cn(buttonVariants({ variant: "ghost", size: "default" }), "gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <CaretRight className="h-4 w-4" />
  </button>
)

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <DotsThree className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
