import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { HttpNativeTransport } from '../src/adapters/standalone/HttpNativeTransport'

describe('Chrome standalone development surface', () => {
  it('forwards native methods through the token-protected local bridge', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ result: { connected: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    const transport = new HttpNativeTransport('', 'standalone-secret')

    await expect(transport.request('supervisorHealth', ['arg'], 1_000)).resolves.toEqual({ connected: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/native')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('x-agent-helm-standalone-token')).toBe('standalone-secret')
    expect(JSON.parse(String(init?.body))).toEqual({ method: 'supervisorHealth', params: ['arg'] })
    fetchMock.mockRestore()
  })

  it('renders production Chrome apps against the real native service instead of the mock preview service', () => {
    const source = readFileSync(new URL('../standalone/StandaloneApp.tsx', import.meta.url), 'utf8')
    expect(source).toContain('new NativeAgentHelmService(transport)')
    expect(source).toContain('new StandaloneAgentHelmService')
    expect(source).toContain('<SidePanelApp client={runtime.client}')
    expect(source).toContain('<PopupApp client={runtime.client}')
    expect(source).toContain('<ExpandedDetailApp client={runtime.client}')
    expect(source).not.toContain('createMockControlPlaneClient')
    expect(source).not.toContain('MockAgentHelmService')
  })
})
