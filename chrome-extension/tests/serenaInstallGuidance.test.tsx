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
      { id: 'external-agent-lsp', label: 'ChatGPT', kind: 'toggle', state: 'running', enabled: true, configurable: true },
      { id: 'local-agent-lsp', label: 'Local Agents', kind: 'toggle', state: 'running', enabled: true, configurable: true },
      { id: 'tunnel', label: 'ChatGPT Secure Tunnel', kind: 'status', state: 'running', apiKeyConfigured: true, tunnelId: 'tunnel-test' },
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
  it('keeps missing Serena status-only on the Code Sense parent in Popup', () => {
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install -p 3.13 serena-agent')}
        pending={null}
        includeCoreRow={false}
        sectionOrder={['code-sense']}
        {...callbacks}
      />,
    )

    expect(html).toContain('data-state="error"')
    expect(html).toMatch(/class="accordion__label"><span class="accordion__title">Code Sense<\/span><span class="popup-runtime-state"/)
    expect(html).toContain('title="Semantic tools are unavailable:')
    expect(html).not.toContain('uv tool install -p 3.13 serena-agent')
    expect(html).not.toContain('>Run<')
    expect(html).not.toContain('>Manual setup<')
  })

  it('forces Serena-dependent child switches visually off and disabled while Serena is unavailable', () => {
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install -p 3.13 serena-agent')}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        codeSenseInitiallyExpanded
        sectionOrder={['code-sense']}
        {...callbacks}
      />,
    )
    const switches = [...html.matchAll(/<button[^>]*role="switch"[^>]*>/g)].map((match) => match[0])
    expect(switches).toHaveLength(2)
    for (const control of switches) {
      expect(control).toContain('aria-checked="false"')
      expect(control).toContain('disabled=""')
    }
  })

  it('uses Code Sense as one group with ChatGPT and Local Agents sub-settings', () => {
    const collapsed = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install -p 3.13 serena-agent')}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        sectionOrder={['code-sense']}
        {...callbacks}
      />,
    )
    expect(collapsed).toContain('aria-expanded="false"')
    expect(collapsed).not.toContain('Local Agents')
    expect(collapsed).not.toContain('uv tool install -p 3.13 serena-agent')

    const expanded = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install -p 3.13 serena-agent')}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        codeSenseInitiallyExpanded
        sectionOrder={['code-sense']}
        {...callbacks}
      />,
    )
    expect(expanded).toContain('ChatGPT')
    expect(expanded).toContain('Local Agents')
    expect(expanded).toContain('uv tool install -p 3.13 serena-agent')
  })

  it('keeps only one settings accordion expanded when multiple initial-open signals are present', () => {
    const value = snapshot()
    value.dependencies.serena = { state: 'ready', command: 'serena' }
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={value}
        pending={null}
        includeCoreRow={false}
        capabilitiesInitiallyExpanded
        codeSenseInitiallyExpanded
        sectionOrder={['capabilities', 'code-sense']}
        {...callbacks}
      />,
    )

    expect(html.match(/aria-expanded=\"true\"/g)?.length).toBe(1)
    expect(html).toContain('>ChatGPT<')
    expect(html).toContain('>Local Agents<')
  })

  it('shows ChatGPT Secure Tunnel failures as a red hoverable dot in Popup without setup content', () => {
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
    expect(html).toMatch(/class="popup-setting-name">ChatGPT Secure Tunnel<span class="popup-runtime-state"/)
    expect(html).toContain('popup-panel-entry__arrow')
    expect(html).toContain('title="Missing required environment: CONTROL_PLANE_API_KEY"')
    expect(html).not.toContain('tunnel-setup-panel')
  })

  it('keeps ChatGPT Secure Tunnel setup collapsed in Side Panel until its chevron is clicked', () => {
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
    expect(html).toMatch(/class="accordion__label"><span class="accordion__title">ChatGPT Secure Tunnel<\/span><span class="popup-runtime-state"/)
    expect(html).not.toContain('tunnel-setup-panel')
  })

  it('opens ChatGPT Secure Tunnel setup when Side Panel is entered from the Popup Tunnel row', () => {
    const value = snapshot()
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={value}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        sectionOrder={['tunnel']}
        tunnelInitiallyExpanded
        onTunnelSetup={async () => value}
        {...callbacks}
      />,
    )

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('tunnel-setup-panel')
  })

  it('uses the canonical settings order and keeps Code Sense readiness only on the parent row', () => {
    const value = snapshot()
    value.dependencies.serena = { state: 'ready', command: 'serena' }
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={value}
        pending={null}
        includeCoreRow={false}
        codeSenseInitiallyExpanded
        agentsMode="navigate"
        onAgentsNavigate={() => {}}
        {...callbacks}
      />,
    )

    const capabilities = html.indexOf('Capabilities')
    const codeSense = html.indexOf('Code Sense')
    const tunnel = html.indexOf('ChatGPT Secure Tunnel')
    const agents = html.indexOf('>Agents<')
    expect(capabilities).toBeGreaterThanOrEqual(0)
    expect(codeSense).toBeGreaterThan(capabilities)
    expect(tunnel).toBeGreaterThan(codeSense)
    expect(agents).toBeGreaterThan(tunnel)
    expect(html).toContain('>ChatGPT<')
    expect(html).toContain('>Local Agents<')
    expect(html.match(/popup-runtime-state/g)?.length).toBe(2)
  })

  it('renders Popup Agents as navigation and shows an explicit empty local-agent state', () => {
    const value = snapshot()
    value.dependencies.serena = { state: 'ready', command: 'serena' }
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={value}
        pending={null}
        includeCoreRow={false}
        sectionOrder={['agents']}
        agentsMode="navigate"
        onAgentsNavigate={() => {}}
        {...callbacks}
      />,
    )

    expect(html).toContain('class="popup-setting-row"')
    expect(html).not.toContain('No local agent connected')
    expect(html).toContain('›')
    expect(html).not.toContain('aria-expanded=')
  })

  it('renders a graphical agent icon separately from the DSH name in expanded Agents', () => {
    const value = snapshot()
    value.agents = [{ id: 'dsh', name: 'DSH', enabled: true, configurable: true, runtimeState: 'ready' }]
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={value}
        pending={null}
        includeCoreRow={false}
        sectionOrder={['agents']}
        agentsInitiallyExpanded
        {...callbacks}
      />,
    )

    expect(html).toMatch(/popup-subrow__name[^>]*><span class="popup-agent-mark"[^>]*><svg[\s\S]*?<\/svg><\/span>DSH<\/span>/)
    expect(html).not.toContain('>DSH</span>DSH')
  })

  it('allows an empty Side Panel Agents section to open and explain that no local agent is connected', () => {
    const value = snapshot()
    value.dependencies.serena = { state: 'ready', command: 'serena' }
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={value}
        pending={null}
        includeCoreRow={false}
        sectionOrder={['agents']}
        agentsInitiallyExpanded
        {...callbacks}
      />,
    )

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('accordion__body')
    expect(html).toContain('No local agent connected')
  })

  it('keeps install actions out of capability rows and wires Code Sense setup only from Side Panel', () => {
    const controlsSource = readFileSync(new URL('../src/components/ExtensionSettingsControls.tsx', import.meta.url), 'utf8')
    const sidePanelSource = readFileSync(new URL('../src/app/SidePanelApp.tsx', import.meta.url), 'utf8')
    const popupSource = readFileSync(new URL('../src/app/PopupApp.tsx', import.meta.url), 'utf8')
    expect(controlsSource).not.toContain("definition.key === 'understand' && serenaDependency?.state === 'unavailable'")
    expect(controlsSource).not.toContain('tunnelOnboardingAutoOpened')
    expect(controlsSource).toContain("section === 'code-sense'")
    expect(controlsSource).toContain("setting.id === 'external-agent-lsp'")
    expect(controlsSource).toContain("setting.id === 'local-agent-lsp'")
    expect(sidePanelSource).toContain('dependencySetupMode="expandable"')
    expect(popupSource).toContain("sectionOrder={['capabilities', 'code-sense', 'tunnel', 'agents']}")
    expect(sidePanelSource).toContain("sectionOrder={['capabilities', 'code-sense', 'tunnel', 'agents']}")
    expect(popupSource).toContain("onAgentsNavigate={() => { void openPanel('agents') }}")
    expect(popupSource).toContain("onTunnelNavigate={() => { void openPanel('tunnel') }}")
    expect(sidePanelSource).toContain('consumePendingSettingsSection')
    expect(sidePanelSource).toContain('agentsInitiallyExpanded={agentsInitiallyExpanded}')
    expect(sidePanelSource).toContain('tunnelInitiallyExpanded={tunnelInitiallyExpanded}')
    expect(sidePanelSource).toContain("section === 'tunnel'")
    expect(controlsSource).toContain('const tunnelAction = onTunnelNavigate ??')
    expect(popupSource).not.toContain("presentation.state === 'error' ? presentation.issue")
    expect(popupSource).toContain("const visibleIssue = error ?? coreIssue")
    expect(sidePanelSource).toContain("const visibleIssue = error ?? coreIssue")
    expect(controlsSource.match(/<section className=\"tunnel-setup-step\">/g)?.length).toBe(3)
    expect(controlsSource).toContain("tunnelDependency?.state === 'unavailable' ? t(agentHelmStep.saveAction.key) : t(agentHelmStep.submitAction.key)")
    expect(controlsSource).toContain("t(openAiStep.dependency.installedAction.key)")
    expect(controlsSource).toContain("t(openAiStep.description.key)")
    expect(controlsSource).toContain("t(chatGptStep.description.key)")
    expect(controlsSource).toContain('className="text-link tunnel-external-link"')
    expect(controlsSource).toContain('↗')
  })
})
