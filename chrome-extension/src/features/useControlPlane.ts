import { useCallback, useEffect, useState } from 'react'
import type { BrowserControlPlaneClient } from '../client/BrowserControlPlaneClient'
import type { ControlPlaneSnapshot, PageContext, WorkHistorySummary } from '../models/controlPlane'

export function useControlPlaneSnapshot(client: BrowserControlPlaneClient) {
  const [snapshot, setSnapshot] = useState<ControlPlaneSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await client.getSnapshot())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (snapshot?.connection.state !== 'install-required') return
    const timer = window.setInterval(() => { void refresh() }, 1500)
    return () => window.clearInterval(timer)
  }, [refresh, snapshot?.connection.state])

  return { snapshot, setSnapshot, error, setError, loading, refresh }
}

export function usePageContext(client: BrowserControlPlaneClient) {
  const [pageContext, setPageContext] = useState<PageContext | null>(null)

  useEffect(() => {
    let cancelled = false
    void client.getCurrentPageContext().then((value) => { if (!cancelled) setPageContext(value) }).catch(() => {})
    const unsubscribe = client.subscribePageContext((value) => { if (!cancelled) setPageContext(value) })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [client])

  return pageContext
}

export function useCurrentConversationWork(client: BrowserControlPlaneClient, pageContext: PageContext | null) {
  const currentUrl = pageContext?.conversationUrl ?? null
  const [lookup, setLookup] = useState<{ url: string | null; work: WorkHistorySummary | null; resolved: boolean }>({
    url: null,
    work: null,
    resolved: false,
  })
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!currentUrl || !pageContext) {
      setLookup({ url: null, work: null, resolved: true })
      return () => { cancelled = true }
    }

    setLookup({ url: currentUrl, work: null, resolved: false })
    void client.findWorkByConversation(pageContext).then((value) => {
      if (!cancelled) setLookup({ url: currentUrl, work: value, resolved: true })
    }).catch(() => {
      if (!cancelled) setLookup({ url: currentUrl, work: null, resolved: true })
    })
    return () => { cancelled = true }
  }, [client, currentUrl, pageContext, refreshVersion])

  const matchesCurrentUrl = lookup.url === currentUrl
  return {
    work: matchesCurrentUrl ? lookup.work : null,
    resolved: currentUrl === null || (matchesCurrentUrl && lookup.resolved),
    refresh: () => setRefreshVersion((value) => value + 1),
  }
}
