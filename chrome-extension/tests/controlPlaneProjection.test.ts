import { describe, expect, it } from 'vitest'
import { MockAgentHelmService } from '../src/adapters/mock/MockAgentHelmService'

import { deriveExtensionConnectionPresentation, workspaceDisplayTitle } from '../src/models/controlPlane'

import { deriveHelmCapabilitySummary, helmCapabilityDefinitions } from '../src/models/presentation'

import { NativeAgentHelmService, projectNativeSnapshot } from '../src/adapters/chrome/NativeAgentHelmService'

describe('Chrome presentation model', () => {
  it('owns capability metadata, order, and enabled-summary projection', () => {
    expect(helmCapabilityDefinitions.map(({ id, icon }) => [id, icon])).toEqual([
      ['understand', '💡'],
      ['coding', '✋'],
      ['command', '👉'],
    ])
    expect(deriveHelmCapabilitySummary({ understand: true, coding: false, command: true }).map(({ id }) => id)).toEqual([
      'understand',
      'command',
    ])
  })
})

describe('native Core snapshot projection', () => {
  const health = {
    status: 'ok',
    dependencies: {
      serena: { configured: true, available: true, command: 'serena', install: { automatic: true, url: 'https://github.com/oraios/serena', command: 'uv tool install -p 3.13 serena-agent' } },
      tunnelClient: { configured: true, available: true, command: 'tunnel-client', install: { automatic: false, url: 'https://github.com/openai/tunnel-client/releases' } },
    },
    serena: {
      connected: true,
      runtimes: [{ workspaceId: 'workspace-1', workPath: '/tmp/workspace-1', connected: true }],
    },
    tunnel: { running: true, logs: [] },
    adapters: [{
      id: 'dsh',
      displayName: 'DSH', delegationEnabled: true,
      capabilities: { persistentSession: true, nativeUi: true, history: true, cancel: true, steer: true, approval: false },
      health: { status: 'ok', nativeUi: true },
    }],
    localMcp: { enabled: true, url: 'http://127.0.0.1:3456/mcp' },
    externalCapabilities: { command: true, semantic: true, read_only: false, delegate: true },
    externalUserAccess: { enabled: true, mutations: true, delegation: true },
    effectiveExternalCapabilities: { command: true, semantic: true, read_only: false, delegate: true },
  }
  const summaries = [{
    id: 'session-1',
    originIntent: { message: 'Implement feature', task: 'Wire native Core status' },
    boundIntents: [],
    chatUrls: ['https://chatgpt.com/c/session-1'],
    activeWorkspaceId: 'workspace-1',
    workspace: { id: 'workspace-1', title: 'example-project' },
    presentation: { title: 'Implement feature', workspaceLabel: 'example-project' },
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:01:00.000Z',
    lastActivityAt: '2026-08-30T00:01:00.000Z',
    eventCount: 4,
    delegationCount: 1,
    chatCount: 1,
  }]

  it('projects authoritative Core health, agents, workspace, and Work History', () => {
    const snapshot = projectNativeSnapshot(health, summaries, [
      { id: 'workspace-1', title: 'example-project', path: '/tmp/workspace-1', available: true },
      { id: 'workspace-2', title: 'second-workspace', path: '/tmp/workspace-2', available: false },
    ])
    expect(snapshot.connection).toEqual({ state: 'connected' })
    expect(snapshot.capabilities).toEqual({
      understand: { enabled: true, available: true },
      code: { enabled: true, available: true },
      command: { enabled: true, available: true },
    })
    expect(snapshot.dependencies).toEqual({
      serena: { state: 'running', command: 'serena', installUrl: 'https://github.com/oraios/serena', installCommand: 'uv tool install -p 3.13 serena-agent' },
      tunnelClient: { state: 'running', command: 'tunnel-client', installUrl: 'https://github.com/openai/tunnel-client/releases' },
    })
    expect(snapshot.agents).toEqual([{ id: 'dsh', name: 'DSH', logo: 'DSH', enabled: true, configurable: true, runtimeState: 'ready' }])
    expect(snapshot.settings.map((setting) => [setting.id, setting.enabled, setting.state])).toEqual([
      ['local-agent-lsp', true, 'running'],
      ['tunnel', undefined, 'running'],
      ['core', true, 'running'],
    ])
    expect(snapshot.workspaces).toEqual([
      { id: 'workspace-1', title: 'example-project', available: true },
      { id: 'workspace-2', title: 'second-workspace', available: false },
    ])
    expect(snapshot.workspaces.map(workspaceDisplayTitle)).toEqual(['example-project', 'second-workspace · unavailable'])
    expect(snapshot.works[0]).toMatchObject({
      id: 'session-1',
      title: 'Implement feature',
      workspaceId: 'workspace-1',
      workspaceTitle: 'example-project',
      eventCount: 4,
      delegationCount: 1,
      chatCount: 1,
    })
  })


  it('allows the total switch only for a daemon process started by this Extension client', () => {
    const external = projectNativeSnapshot({
      ...health,
      clientLifecycle: { managed: false, configurable: false },
    }, summaries)
    expect(external.settings.find((setting) => setting.id === 'core')).toMatchObject({
      enabled: true,
      configurable: false,
      state: 'running',
    })

    const managed = projectNativeSnapshot({
      ...health,
      clientLifecycle: { managed: true, configurable: true },
    }, summaries)
    expect(managed.settings.find((setting) => setting.id === 'core')).toMatchObject({
      enabled: true,
      configurable: true,
      state: 'running',
    })
  })

  it('preserves authoritative runtime error details for aggregate status', () => {
    const snapshot = projectNativeSnapshot({
      ...health,
      tunnel: { managed: false, reason: 'missing-env', missingEnvironment: ['CONTROL_PLANE_TUNNEL_ID'] },
      adapters: [{
        id: 'dsh',
        displayName: 'DSH', delegationEnabled: true,
        capabilities: {},
        health: { status: 'error', error: 'DSH adapter unavailable' },
      }],
    }, summaries)
    const tunnel = snapshot.settings.find((setting) => setting.id === 'tunnel')
    expect(tunnel).toMatchObject({
      state: 'error',
      message: 'Missing required environment: CONTROL_PLANE_TUNNEL_ID',
      missingEnvironment: ['CONTROL_PLANE_TUNNEL_ID'],
    })
    expect(snapshot.agents[0]).toMatchObject({ runtimeState: 'error', message: 'DSH adapter unavailable' })
    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({
      state: 'error',
      issue: 'Tunnel: Missing required environment: CONTROL_PLANE_TUNNEL_ID',
    })
  })

  it('preserves agent metadata while projecting Core-off state consistently', () => {
    const snapshot = projectNativeSnapshot({
      ...health,
      status: 'disabled',
      tunnel: { managed: false, reason: 'core-disabled' },
      localMcp: { enabled: false, url: 'http://127.0.0.1:3456/mcp' },
    }, summaries)
    expect(snapshot.agents[0]).toMatchObject({ id: 'dsh', enabled: true, configurable: true, runtimeState: 'stopped' })
    expect(snapshot.settings.find((setting) => setting.id === 'core')).toMatchObject({ enabled: false, state: 'stopped' })
    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({ state: 'disconnected' })
  })
})

describe('native host bootstrap projection', () => {
  it('keeps the Core switch available when the Native Host is installed but the daemon is stopped', async () => {
    const transport = {
      async request() { throw new Error('Agent Helm daemon is not running.') },
      async probe() { return { state: 'connected' as const } },
    }
    const service = new NativeAgentHelmService(transport as never)
    const snapshot = await service.getSnapshot()
    expect(snapshot.connection).toEqual({ state: 'connected' })
    expect(snapshot.settings.find((setting) => setting.id === 'core')).toMatchObject({
      enabled: false,
      configurable: true,
      state: 'stopped',
    })
    expect(snapshot.agents).toEqual([])
    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({ state: 'disconnected' })
  })


  it('surfaces the exact daemon socket and attach failure from the Native Host', async () => {
    const transport = {
      async request() { throw new Error('supervisor health unavailable') },
      async daemonProbe() {
        return {
          connected: false,
          managed: false,
          socket: '/tmp/agent-helm-test.sock',
          reason: 'incompatible-daemon' as const,
          error: 'Agent Helm daemon at /tmp/agent-helm-test.sock is running but does not support the current browser control protocol. Restart Agent Helm with the current version.',
        }
      },
      async probe() { return { state: 'connected' as const } },
    }
    const service = new NativeAgentHelmService(transport as never)
    const snapshot = await service.getSnapshot()
    expect(snapshot.settings.find((setting) => setting.id === 'core')).toMatchObject({
      enabled: true,
      configurable: false,
      state: 'error',
      message: 'Agent Helm daemon at /tmp/agent-helm-test.sock is running but does not support the current browser control protocol. Restart Agent Helm with the current version.',
    })
    expect(snapshot.settings.find((setting) => setting.id === 'local-agent-lsp')).toMatchObject({ state: 'unavailable', configurable: false })
    expect(snapshot.settings.find((setting) => setting.id === 'tunnel')).toMatchObject({ state: 'unavailable' })
    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({
      state: 'error',
      issue: 'Agent Helm Service: Agent Helm daemon at /tmp/agent-helm-test.sock is running but does not support the current browser control protocol. Restart Agent Helm with the current version.',
    })
  })
})

describe('extension connection presentation', () => {
  it('projects healthy, disabled Core, and request-error states consistently', async () => {
    const service = new MockAgentHelmService()
    const snapshot = await service.getSnapshot()

    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({ state: 'connected' })

    const core = snapshot.settings.find((setting) => setting.id === 'core')
    const tunnel = snapshot.settings.find((setting) => setting.id === 'tunnel')
    if (!core || !tunnel) throw new Error('missing core/tunnel projection')
    core.enabled = false
    core.state = 'stopped'
    tunnel.state = 'stopped'
    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({ state: 'disconnected' })

    expect(deriveExtensionConnectionPresentation(snapshot, 'native request failed')).toEqual({
      state: 'error',
      issue: 'native request failed',
    })
  })

  it('raises nested runtime failures but ignores an intentionally stopped local LSP', async () => {
    const service = new MockAgentHelmService()
    const snapshot = await service.getSnapshot()
    const localAgentLsp = snapshot.settings.find((setting) => setting.id === 'local-agent-lsp')
    const tunnel = snapshot.settings.find((setting) => setting.id === 'tunnel')
    if (!localAgentLsp || !tunnel) throw new Error('missing runtime projections')

    localAgentLsp.enabled = false
    localAgentLsp.state = 'stopped'
    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({ state: 'connected' })

    snapshot.dependencies.serena.state = 'unavailable'
    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({ state: 'connected' })

    tunnel.state = 'stopped'
    expect(deriveExtensionConnectionPresentation(snapshot)).toEqual({
      state: 'error',
      issue: `${tunnel.label}: stopped`,
    })
  })
})

describe('Issue #12 control-plane projection', () => {
  it('projects only DSH in the Phase 1 Agents surface', async () => {
    const service = new MockAgentHelmService()
    const snapshot = await service.getSnapshot()
    expect(snapshot.agents.map((agent) => agent.id)).toEqual(['dsh'])
    expect(snapshot.agents[0]).toMatchObject({ enabled: true, configurable: true, runtimeState: 'ready' })

    const disabled = await service.setAgentEnabled('dsh', false)
    expect(disabled.agents[0]?.enabled).toBe(false)
  })

  it('projects only Core-owned settings/status required by Issue #12', async () => {
    const service = new MockAgentHelmService()
    const snapshot = await service.getSnapshot()
    expect(snapshot.settings.map((setting) => [setting.id, setting.kind])).toEqual([
      ['local-agent-lsp', 'toggle'],
      ['tunnel', 'status'],
      ['core', 'toggle'],
    ])
  })
})
