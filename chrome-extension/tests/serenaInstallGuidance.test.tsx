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
      { id: 'local-agent-lsp', label: 'DSH', kind: 'toggle', state: 'running', enabled: true, configurable: true },
      { id: 'native-codex', label: 'Codex', kind: 'toggle', state: 'running', installed: true, enabled: true, configurable: true },
      { id: 'native-claude', label: 'Claude Code', kind: 'toggle', state: 'running', installed: true, enabled: true, configurable: true },
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
        snapshot={snapshot('uv tool install --force -p 3.13 serena-agent==1.7.0')}
        pending={null}
        includeCoreRow={false}
        sectionOrder={['code-sense']}
        {...callbacks}
      />,
    )

    expect(html).toContain('data-state="error"')
    expect(html).toMatch(/class="accordion__label"><span class="accordion__title">Code Sense<\/span><span class="popup-runtime-state"/)
    expect(html).toContain('title="Semantic tools are unavailable:')
    expect(html).not.toContain('uv tool install --force -p 3.13 serena-agent==1.7.0')
    expect(html).not.toContain('>Run<')
    expect(html).not.toContain('>Manual setup<')
  })

  it('forces Serena-dependent child switches visually off and disabled while Serena is unavailable', () => {
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install --force -p 3.13 serena-agent==1.7.0')}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        codeSenseInitiallyExpanded
        sectionOrder={['code-sense']}
        {...callbacks}
      />,
    )
    const switches = [...html.matchAll(/<button[^>]*role="switch"[^>]*>/g)].map((match) => match[0])
    expect(switches).toHaveLength(4)
    for (const control of switches) {
      expect(control).toContain('aria-checked="false"')
      expect(control).toContain('disabled=""')
    }
  })

  it('uses Code Sense as one group with independent ChatGPT, DSH, Codex and Claude Code switches', () => {
    const collapsed = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install --force -p 3.13 serena-agent==1.7.0')}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        sectionOrder={['code-sense']}
        {...callbacks}
      />,
    )
    expect(collapsed).toContain('aria-expanded="false"')
    expect(collapsed).not.toContain('>DSH<')
    expect(collapsed).not.toContain('uv tool install --force -p 3.13 serena-agent==1.7.0')

    const expanded = renderToStaticMarkup(
      <ExtensionSettingsControls
        snapshot={snapshot('uv tool install --force -p 3.13 serena-agent==1.7.0')}
        pending={null}
        includeCoreRow={false}
        dependencySetupMode="expandable"
        codeSenseInitiallyExpanded
        sectionOrder={['code-sense']}
        {...callbacks}
      />,
    )
    expect(expanded).toContain('ChatGPT')
    expect(expanded).toContain('>DSH<')
    expect(expanded).toContain('>Codex<')
    expect(expanded).toContain('>Claude Code<')
    expect(expanded).toContain('uv tool install --force -p 3.13 serena-agent==1.7.0')
  })

  it('shows missing Core native status as upgrade-required, not as a missing Codex/Claude installation', () => {
    const value = snapshot()
    value.dependencies.serena = { state: 'ready', command: 'serena' }
    for (const setting of value.settings.filter((setting) => setting.id.startsWith('native-'))) {
      setting.state = 'unavailable'
      setting.configurable = false
      setting.enabled = false
      delete setting.installed
    }
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls snapshot={value} pending={null} includeCoreRow={false}
        codeSenseInitiallyExpanded sectionOrder={['code-sense']} {...callbacks} />,
    )
    expect(html).toContain('Codex (Core update required)')
    expect(html).toContain('Claude Code (Core update required)')
    expect(html).not.toContain('(not installed)')
    const absent = value.settings.find((setting) => setting.id === 'native-claude')
    if (!absent) throw new Error('missing Claude setting')
    absent.installed = false
    const observedHtml = renderToStaticMarkup(
      <ExtensionSettingsControls snapshot={value} pending={null} includeCoreRow={false}
        codeSenseInitiallyExpanded sectionOrder={['code-sense']} {...callbacks} />,
    )
    expect(observedHtml).toContain('Claude Code (not installed)')
    expect(observedHtml).toContain('Codex (Core update required)')
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
    expect(html).toContain('>DSH<')
    expect(html).toContain('>Codex<')
    expect(html).toContain('>Claude Code<')
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
    expect(html).toContain('>DSH<')
    expect(html).toContain('>Codex<')
    expect(html).toContain('>Claude Code<')
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

    expect(html).toMatch(/popup-subrow__name[^>]*><span class="popup-agent-mark"[^>]*><span[^>]*>DSH<\/span><\/span>DSH<\/span>/)
    expect(html).not.toMatch(/<span class="popup-agent-mark"[^>]*><svg/)
  })

  it('shows the macOS app icon when Core supplies native PNG data and falls back for CLI-only agents', () => {
    const value = snapshot()
    const png = 'data:image/png;base64,iVBORw0KGgo='
    value.agents = [
      { id: 'codex', name: 'Codex', iconDataUrl: png, enabled: true, configurable: true, runtimeState: 'ready' },
      { id: 'dsh', name: 'DSH', enabled: true, configurable: true, runtimeState: 'ready' },
    ]
    const html = renderToStaticMarkup(
      <ExtensionSettingsControls snapshot={value} pending={null} includeCoreRow={false} sectionOrder={['agents']} agentsInitiallyExpanded {...callbacks} />,
    )
    expect(html).toContain(`src="${png}"`)
    expect(html).toContain('>DSH</span>')
    expect(html).not.toMatch(/<span class="popup-agent-mark"[^>]*><svg/)
    expect(html).toMatch(/border:1px solid rgba\(128,128,128,\.28\)/)
    expect(html).toContain('background:transparent')
    const nativeIcon = html.match(/<img[^>]*>/)?.[0]
    expect(nativeIcon).toBeDefined()
    expect(nativeIcon).not.toMatch(/border:|background:/)
    const css = readFileSync(new URL('../src/app/styles.css', import.meta.url), 'utf8')
    const shell = css.match(/\.popup-agent-mark \{([^}]+)\}/)?.[1]
    expect(shell).toBeDefined()
    expect(shell).not.toMatch(/\bborder\s*:|\bbackground\s*:/)
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
    expect(popupSource).toContain("sectionOrder={['capabilities', 'code-sense', 'tunnel', 'agents', 'external-mcp']}")
    expect(sidePanelSource).toContain("sectionOrder={['capabilities', 'code-sense', 'tunnel', 'agents', 'external-mcp']}")
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
