import * as TogglePrimitive from '@radix-ui/react-toggle'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../../lib/utils'

const toggleVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-700 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-blue-600 data-[state=on]:text-white',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-slate-600 bg-transparent shadow-sm hover:bg-slate-800 hover:text-slate-100',
      },
      size: {
        default: 'h-9 px-3 min-w-9',
        sm: 'h-8 px-2 min-w-8',
        lg: 'h-10 px-3 min-w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root className={cn(toggleVariants({ variant, size, className }))} {...props} />
  )
}

export { Toggle, toggleVariants }
