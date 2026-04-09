import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[0.375rem] px-2.5 py-0.5 transition-colors focus:outline-none label-caps",
  {
    variants: {
      variant: {
        default: "bg-[var(--surface-bright)] text-[var(--primary)] border border-transparent",
        secondary: "bg-[var(--surface-mid)] text-[var(--secondary)] border border-[var(--outline-variant)]",
        destructive: "bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/30",
        outline: "text-[var(--on-surface-muted)] border border-[var(--outline-variant)] bg-transparent",
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
