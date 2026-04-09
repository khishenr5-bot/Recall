import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "input-glow flex h-10 w-full rounded-[0.375rem] border border-[var(--outline-variant)] bg-[var(--surface-highest)] px-3 py-2 text-sm text-[var(--on-surface)] transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--on-surface-muted)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
