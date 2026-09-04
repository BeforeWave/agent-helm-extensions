import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [state, setState] = useState<{ value: PageContext | null; resolved: boolean }>({ value: null, resolved: false })

  useEffect(() => {
    let cancelled = false
    let subscriptionObserved = false
    const unsubscribe = client.subscribePageContext((value) => {
      subscriptionObserved = true
      if (!cancelled) setState({ value, resolved: true })
    })
    void client.getCurrentPageContext().then((value) => {
      if (!cancelled && !subscriptionObserved) setState({ value, resolved: true })
    }).catch(() => {
      if (!cancelled && !subscriptionObserved) setState({ value: null, resolved: true })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [client])

  return state
}

export function isCurrentConversationResolved(input: {
  pageContextResolved: boolean
  currentUrl: string | null
  lookupUrl: string | null
  lookupResolved: boolean
}): boolean {
  return input.pageContextResolved && (
    input.currentUrl === null
    || (input.lookupUrl === input.currentUrl && input.lookupResolved)
  )
}

export function useCurrentConversationWork(
  client: BrowserControlPlaneClient,
  pageContext: PageContext | null,
  pageContextResolved: boolean,
) {
  const currentUrl = pageContext?.conversationUrl ?? null
  const pageContextRef = useRef(pageContext)
  pageContextRef.current = pageContext
  const [lookup, setLookup] = useState<{ url: string | null; work: WorkHistorySummary | null; resolved: boolean }>({
    url: null,
    work: null,
    resolved: false,
  })
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!pageContextResolved) {
      setLookup({ url: null, work: null, resolved: false })
      return () => { cancelled = true }
    }
    const lookupContext = pageContextRef.current
    if (!currentUrl || !lookupContext) {
      setLookup({ url: null, work: null, resolved: true })
      return () => { cancelled = true }
    }

    setLookup({ url: currentUrl, work: null, resolved: false })
    void client.findWorkByConversation(lookupContext).then((value) => {
      if (!cancelled) setLookup({ url: currentUrl, work: value, resolved: true })
    }).catch(() => {
      if (!cancelled) setLookup({ url: currentUrl, work: null, resolved: true })
    })
    return () => { cancelled = true }
  }, [client, currentUrl, pageContextResolved, refreshVersion])

  const matchesCurrentUrl = lookup.url === currentUrl
  return {
    work: matchesCurrentUrl ? lookup.work : null,
    resolved: isCurrentConversationResolved({
      pageContextResolved,
      currentUrl,
      lookupUrl: lookup.url,
      lookupResolved: lookup.resolved,
    }),
    refresh: () => setRefreshVersion((value) => value + 1),
  }
}
