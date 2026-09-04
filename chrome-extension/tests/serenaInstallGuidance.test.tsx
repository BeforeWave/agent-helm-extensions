import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ExtensionSettingsControls } from '../src/components/ExtensionSettingsControls'
import type { ControlPlaneSnapshot } from '../src/models/controlPlane'

function snapshot(installCommand?: string): ControlPlaneSnapshot {
  return {
    connection: { state: 'connected' },
    capabilities: {
      understand: { enabled: true, available: installCommand !== undefined },
      code: { enabled: true, available: true },
      command: { enabled: true, available: true },
    },
    dependencies: {
      serena: {
        state: 'unavailable',
        command: 'serena',
        installUrl: 'https://github.com/oraios/serena',
        ...(installCommand ? { installCommand } : {}),
      },
      tunnelClient: { state: 'ready', command: 'tunnel-client' },
    },
    agents: [],
    settings: [
      { id: 'core', label: 'Agent Helm Service', kind: 'toggle', state: 'running', enabled: true, configurable: true },
      { id: 'local-agent-lsp', label: 'Local Agent LSP', kind: 'toggle', state: 'running', enabled: true, configurable: true },
      { id: 'tunnel', label: 'Tunnel', kind: 'status', state: 'running', apiKeyConfigured: true, tunnelId: 'tunnel-test' },
    ],
    workspaces: [],
    works: [],
  }
}

const callbacks = {
  onCapabilityChange: () => {},
  onAgentChange: () => {},
  onSettingChange: () => {},
  onDependencyInstall: () => {},
  onOpenUrl: () => {},
  onInstallerDownload: () => {},
}

describe('Chrome dependency guidance surfaces', () => {
  it('keeps missing Serena status-only in Popup with a red hoverable error dot', () => {
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install -p 3.13 serena-agent')}
        pending={null}
        includeCoreRow={false}
        sectionOrder={['local-agent-lsp']}
        {...callbacks}
      />,
    )

    expect(html).toContain('data-state="error"')
    expect(html).toContain('title="Semantic tools are unavailable:')
    expect(html).not.toContain('uv tool install -p 3.13 serena-agent')
    expect(html).not.toContain('>Run<')
    expect(html).not.toContain('>Manual setup<')
    expect(html).not.toContain('popup-dependency-expand')
  })

  it('adds a collapsed Serena setup chevron only for the Side Panel expandable mode', () => {
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install -p 3.13 serena-agent')}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        sectionOrder={['local-agent-lsp']}
        {...callbacks}
      />,
    )

    expect(html).toContain('popup-dependency-expand')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('uv tool install -p 3.13 serena-agent')
  })

  it('shows Tunnel failures as a red hoverable dot in Popup without setup content', () => {
    const value = snapshot()
    value.dependencies.tunnelClient = { state: 'unavailable', command: 'tunnel-client' }
    const tunnel = value.settings.find((setting) => setting.id === 'tunnel')
    if (!tunnel) throw new Error('missing tunnel')
    tunnel.state = 'error'
    tunnel.message = 'Missing required environment: CONTROL_PLANE_API_KEY'

    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={value}
        pending={null}
        includeCoreRow={false}
        sectionOrder={['tunnel']}
        onTunnelNavigate={() => {}}
        {...callbacks}
      />,
    )

    expect(html).toContain('data-state="error"')
    expect(html).toContain('title="Missing required environment: CONTROL_PLANE_API_KEY"')
    expect(html).not.toContain('tunnel-setup-panel')
  })

  it('keeps Tunnel setup collapsed in Side Panel until its chevron is clicked', () => {
    const value = snapshot()
    const tunnel = value.settings.find((setting) => setting.id === 'tunnel')
    if (!tunnel) throw new Error('missing tunnel')
    tunnel.state = 'error'
    tunnel.message = 'Missing required environment: CONTROL_PLANE_API_KEY'
    tunnel.apiKeyConfigured = false

    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={value}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        sectionOrder={['tunnel']}
        onTunnelSetup={async () => value}
        {...callbacks}
      />,
    )

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('data-state="error"')
    expect(html).not.toContain('tunnel-setup-panel')
  })

  it('keeps install actions out of capability rows and wires expandable dependency setup only from Side Panel', () => {
    const controlsSource = readFileSync(new URL('../src/components/ExtensionSettingsControls.tsx', import.meta.url), 'utf8')
    const sidePanelSource = readFileSync(new URL('../src/app/SidePanelApp.tsx', import.meta.url), 'utf8')
    const popupSource = readFileSync(new URL('../src/app/PopupApp.tsx', import.meta.url), 'utf8')
    expect(controlsSource).not.toContain("definition.key === 'understand' && serenaDependency?.state === 'unavailable'")
    expect(controlsSource).not.toContain('tunnelOnboardingAutoOpened')
    expect(controlsSource).toContain('canExpand && localAgentLspExpanded')
    expect(sidePanelSource).toContain('dependencySetupMode="expandable"')
    expect(popupSource).not.toContain("presentation.state === 'error' ? presentation.issue")
  })
})
