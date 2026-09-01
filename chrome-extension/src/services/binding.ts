import { isWorkHistoryConversationBound } from '@beforewave/agent-helm-ui-contract'
import type { PageContext, WorkHistoryDetail } from '../models/controlPlane'

export function isConversationBound(detail: WorkHistoryDetail | null | undefined, pageContext: PageContext | null | undefined): boolean {
  const current = pageContext?.conversationUrl
  if (!detail) return false
  return isWorkHistoryConversationBound(detail.chatUrls, current)
}
