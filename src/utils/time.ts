export const formatRelativeTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  return diffDays > 0
    ? `${diffDays}d ago`
    : diffHours > 0
      ? `${diffHours}h ago`
      : diffMinutes > 0
        ? `${diffMinutes}m ago`
        : 'just now'
}

export const parseKmlTimestamp = (timestamp: string | undefined): Date =>
  timestamp ? new Date(timestamp) : new Date()
