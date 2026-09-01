const PREFIX = 'agent-helm-work:'

export function notificationIdForWork(workId: string): string {
  return `${PREFIX}${encodeURIComponent(workId)}`
}

export function workIdFromNotificationId(notificationId: string): string | null {
  if (!notificationId.startsWith(PREFIX)) return null
  try {
    return decodeURIComponent(notificationId.slice(PREFIX.length))
  } catch {
    return null
  }
}
