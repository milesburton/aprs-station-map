/**
 * Design tokens for consistent styling across the application.
 * Uses Tailwind CSS class names as values.
 */

export const spacing = {
  /** Extra small spacing - 0.5rem / 8px */
  xs: 'gap-2',
  /** Small spacing - 0.75rem / 12px */
  sm: 'gap-3',
  /** Medium spacing - 1rem / 16px */
  md: 'gap-4',
  /** Large spacing - 1.5rem / 24px */
  lg: 'gap-6',
  /** Extra large spacing - 2rem / 32px */
  xl: 'gap-8',
} as const

export const padding = {
  /** Extra small padding - 0.5rem / 8px */
  xs: 'p-2',
  /** Small padding - 0.75rem / 12px */
  sm: 'p-3',
  /** Medium padding - 1rem / 16px */
  md: 'p-4',
  /** Large padding - 1.5rem / 24px */
  lg: 'p-6',
  /** Extra large padding - 2rem / 32px */
  xl: 'p-8',
} as const

export const margin = {
  /** Extra small margin - 0.5rem / 8px */
  xs: 'mb-2',
  /** Small margin - 0.75rem / 12px */
  sm: 'mb-3',
  /** Medium margin - 1rem / 16px */
  md: 'mb-4',
  /** Large margin - 1.5rem / 24px */
  lg: 'mb-6',
  /** Extra large margin - 2rem / 32px */
  xl: 'mb-8',
} as const

export const borderRadius = {
  /** Small radius - 0.375rem / 6px */
  sm: 'rounded-md',
  /** Medium radius - 0.5rem / 8px */
  md: 'rounded-lg',
  /** Large radius - 0.75rem / 12px */
  lg: 'rounded-xl',
} as const

export const fontSize = {
  /** Extra small text - 0.75rem / 12px */
  xs: 'text-xs',
  /** Small text - 0.875rem / 14px */
  sm: 'text-sm',
  /** Base text - 1rem / 16px */
  base: 'text-base',
  /** Large text - 1.125rem / 18px */
  lg: 'text-lg',
  /** Extra large text - 1.25rem / 20px */
  xl: 'text-xl',
  /** 2XL text - 1.5rem / 24px */
  '2xl': 'text-2xl',
  /** 3XL text - 1.875rem / 30px */
  '3xl': 'text-3xl',
} as const

export const colors = {
  bg: {
    primary: 'bg-slate-900',
    secondary: 'bg-slate-800',
    tertiary: 'bg-slate-700',
  },
  text: {
    primary: 'text-slate-100',
    secondary: 'text-slate-400',
    muted: 'text-slate-500',
  },
  accent: {
    blue: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-500',
    orange: 'text-orange-400',
    purple: 'text-purple-400',
  },
  status: {
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
  },
  border: {
    primary: 'border-slate-700',
    accent: 'border-blue-500',
  },
} as const

/** Card component styles */
export const card = {
  base: 'bg-slate-800 rounded-lg',
  padding: 'p-6',
  full: 'bg-slate-800 rounded-lg p-6',
} as const

/** Inner card/item styles (nested within cards) */
export const innerCard = {
  base: 'bg-slate-900 rounded-lg',
  padding: 'p-4',
  full: 'bg-slate-900 rounded-lg p-4',
} as const

/** Tab content wrapper styles */
export const tabContent = {
  base: 'flex-1 overflow-y-auto p-6 bg-slate-900',
  withGap: 'flex-1 overflow-y-auto p-6 bg-slate-900 flex flex-col gap-6',
} as const

/** Standard section heading */
export const heading = {
  section: 'text-lg font-semibold text-slate-100 mb-4',
  card: 'text-xl font-semibold text-slate-100 mb-4',
} as const
