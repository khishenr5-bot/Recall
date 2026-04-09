import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.375rem] text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "gradient-btn",
        destructive: "bg-[var(--error)] text-white hover:bg-[var(--error)]/90",
        outline: "border border-[var(--outline-variant)] bg-[var(--surface-high)] text-[var(--on-surface)] hover:bg-[var(--surface-bright)] hover:text-white",
        secondary: "bg-[var(--surface-bright)] text-[var(--on-surface)] hover:bg-[var(--surface-highest)]",
        ghost: "hover:bg-[var(--surface-bright)] text-[var(--on-surface)] hover:text-white",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-10 px-5 py-2",
        sm: "min-h-8 rounded-[0.375rem] px-3 text-xs",
        lg: "min-h-12 rounded-[0.5rem] px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
