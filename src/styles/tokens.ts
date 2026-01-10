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

export const card = {
  base: 'bg-slate-800 rounded-lg',
  padding: 'p-6',
  full: 'bg-slate-800 rounded-lg p-6',
} as const

export const innerCard = {
  base: 'bg-slate-900 rounded-lg',
  padding: 'p-4',
  full: 'bg-slate-900 rounded-lg p-4',
} as const

export const tabContent = {
  base: 'flex-1 overflow-y-auto p-6 bg-slate-900',
  withGap: 'flex-1 overflow-y-auto p-6 bg-slate-900 flex flex-col gap-6',
} as const

export const heading = {
  section: 'text-lg font-semibold text-slate-100 mb-4',
  card: 'text-xl font-semibold text-slate-100 mb-4',
} as const
