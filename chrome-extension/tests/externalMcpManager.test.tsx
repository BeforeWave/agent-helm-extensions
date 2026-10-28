import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NativeAgentHelmService } from '../src/adapters/chrome/NativeAgentHelmService'
import { ExtensionSettingsControls } from '../src/components/ExtensionSettingsControls'
import type { ExternalMcpServer } from '../src/models/adapters'

const imported: ExternalMcpServer = {
  id: 'mcp:12345678-1234-1234-1234-123456789abc', name: 'shared-notes', source: 'agent-helm',
  sources: [{ source: 'codex', name: 'shared-notes' }], status: 'imported',
}
const discovered: ExternalMcpServer = {
  id: 'codex:shared-notes', name: 'shared-notes', source: 'codex', status: 'discovered',
}

describe('External MCP import management surface', () => {
  it('forwards list/import/enable/disable to Core through the established Native Host protocol', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = []
    const transport = {
      request: async (method: string, args: unknown[] = []) => {
        calls.push({ method, args })
        return method === 'listExternalMcpServers' ? [discovered]
          : method === 'scanExternalMcpServers' ? { servers: [imported], failures: [] } : [imported]
      },
    }
    const service = new NativeAgentHelmService(transport as never)
    expect(await service.listExternalMcpServers()).toEqual([discovered])
    expect(await service.scanExternalMcpServers()).toEqual({ servers: [imported], failures: [] })
    expect(await service.importExternalMcpServer(discovered.id)).toEqual([imported])
    await service.configureExternalMcpEnv(imported.id, { MY_TOKEN: 'some-secret' })
    await service.beginExternalMcpOAuth(imported.id)
    await service.configureExternalMcpOAuth(imported.id, { grantType: 'client_credentials', clientId: 'client-id', clientSecret: 'fixture-secret' })
    await service.configureExternalMcpHttpHeaders(imported.id, {Authorization:'Bearer some-secret'})
    await service.setExternalMcpEnabled(imported.id, true)
    await service.setExternalMcpEnabled(imported.id, false)
    expect(calls).toEqual([
      { method: 'listExternalMcpServers', args: [] },
      { method: 'scanExternalMcpServers', args: [] },
      { method: 'importExternalMcpServer', args: ['codex:shared-notes'] },
      { method: 'configureExternalMcpEnv', args: [imported.id, { MY_TOKEN: 'some-secret' }] },
      { method: 'beginExternalMcpOAuth', args: [imported.id] },
      { method: 'configureExternalMcpOAuth', args: [imported.id, { grantType: 'client_credentials', clientId: 'client-id', clientSecret: 'fixture-secret' }] },
      { method: 'configureExternalMcpHttpHeaders', args: [imported.id, {Authorization:'Bearer some-secret'}] },
      { method: 'setExternalMcpEnabled', args: [imported.id, true] },
      { method: 'setExternalMcpEnabled', args: [imported.id, false] },
    ])
  })

  it('shares one Settings implementation and makes Popup navigation and Side Panel management distinct', () => {
    const callbacks = {
      onCapabilityChange: () => {}, onAgentChange: () => {}, onSettingChange: () => {},
      onDependencyInstall: () => {}, onOpenUrl: () => {}, onInstallerDownload: () => {},
    }
    const popup = renderToStaticMarkup(<ExtensionSettingsControls snapshot={null} pending={null}
      sectionOrder={['external-mcp']} externalMcpMode="navigate" onExternalMcpNavigate={() => {}} {...callbacks} />)
    const sidepanel = renderToStaticMarkup(<ExtensionSettingsControls snapshot={null} pending={null}
      sectionOrder={['external-mcp']} externalMcpInitiallyExpanded
      onExternalMcpList={async () => [discovered]} onExternalMcpScan={async () => ({ servers: [discovered], failures: [] })} onExternalMcpImport={async () => [imported]}
      onExternalMcpChange={async () => [imported]} onExternalMcpConfigure={async () => [imported]}
      onExternalMcpAuthorize={async () => ({})} onExternalMcpConfigureOAuth={async () => [imported]} onExternalMcpConfigureHeaders={async () => [imported]} {...callbacks} />)
    expect(popup).toContain('MCP Servers')
    expect(popup).not.toContain('aria-expanded=')
    expect(sidepanel).toContain('aria-expanded="true"')
    expect(sidepanel).toContain('helm-mcp-manager')
    expect(sidepanel).toContain('My MCP Servers')
    expect(sidepanel).toContain('Discover MCPs')
    expect(sidepanel).toContain('Scan')
  })
})
