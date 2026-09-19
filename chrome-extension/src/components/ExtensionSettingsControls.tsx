import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { StatusDot } from '../components/Status'
import { Switch } from '../components/Switch'
import { runtimeStateLabel, t } from '../locale'
import type { CapabilityKey, DependencyName } from '../models/controlPlane'
import extensionManifest from '../../package.json'
import { agentHelmInstallerSourceForRelease, agentHelmMacosInstallerFilename, tunnelOnboardingSource, tunnelSetupCanSubmit, type TunnelSetupValues } from '../ui-contract'
import { AgentIcon } from './Icons'

import { Accordion } from '../components/Accordion'

import {
  deriveHelmCapabilitySummary,
  helmCapabilityDefinitions,
  shouldCompactHelmCapabilitySummary,
} from '../models/presentation'

const browserManifest = typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest() : undefined
const extensionReleaseVersion = typeof browserManifest?.version_name === 'string' && browserManifest.version_name.trim()
  ? browserManifest.version_name.trim()
  : extensionManifest.version
const fixedAgentHelmInstallerSource = agentHelmInstallerSourceForRelease(extensionReleaseVersion)

const CAPABILITIES = helmCapabilityDefinitions.map((definition) => ({
  ...definition,
  key: (definition.id === 'coding' ? 'code' : definition.id) as CapabilityKey,
}))

type CapabilitySummaryItem = { icon: string; label: string }

function TunnelFieldInfo({ label }: { label: string }): React.JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 0, width: 280 })
  const open = hovered || focused

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const update = () => {
      const button = buttonRef.current
      if (!button) return
      const rect = button.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth
      const margin = 12
      const width = Math.max(0, Math.min(300, viewportWidth - margin * 2))
      const centeredLeft = rect.left + rect.width / 2 - width / 2
      const left = Math.min(Math.max(margin, centeredLeft), Math.max(margin, viewportWidth - width - margin))
      setPosition({ left, top: rect.top - 7, width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  return <>
    <button
      ref={buttonRef}
      type="button"
      className="tunnel-field-info"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >i</button>
    {open && typeof document !== 'undefined' ? createPortal(
      <div className="tunnel-field-tooltip" role="tooltip" style={{ left: position.left, top: position.top, width: position.width }}>{label}</div>,
      document.body,
    ) : null}
  </>
}

function CapabilitySummary({ items }: { items: CapabilitySummaryItem[] }): React.JSX.Element {
  const rootRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [compact, setCompact] = useState(false)
  const itemKey = items.map(({ icon, label }) => `${icon}:${label}`).join('|')

  useLayoutEffect(() => {
    const root = rootRef.current
    const measure = measureRef.current
    if (!root || !measure) return
    const update = () => setCompact(shouldCompactHelmCapabilitySummary(measure.getBoundingClientRect().width, root.clientWidth))
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(root)
    return () => observer.disconnect()
  }, [itemKey])

  const renderItems = (keyPrefix: string) => items.map(({ icon, label }) => (
    <span key={`${keyPrefix}:${icon}:${label}`} className="popup-caps-item">
      <span aria-hidden="true">{icon}</span>
      <span className="popup-caps-item__label">{label}</span>
    </span>
  ))

  return (
    <span ref={rootRef} className="popup-capability-summary" data-compact={compact || undefined} aria-hidden="true">
      {renderItems('visible')}
      <span ref={measureRef} className="popup-caps-measure">{renderItems('measure')}</span>
    </span>
  )
}

export type ExtensionSettingsSection = 'capabilities' | 'agents' | 'code-sense' | 'tunnel'

export const DEFAULT_EXTENSION_SETTINGS_SECTION_ORDER: readonly ExtensionSettingsSection[] = [
  'capabilities',
  'code-sense',
  'tunnel',
  'agents',
]

type SettingsControlsProps = {
  snapshot: import('../models/controlPlane').ControlPlaneSnapshot | null
  pending: string | null
  loading?: boolean
  capabilitiesInitiallyExpanded?: boolean
  agentsInitiallyExpanded?: boolean
  agentsMode?: 'accordion' | 'navigate'
  codeSenseInitiallyExpanded?: boolean
  tunnelInitiallyExpanded?: boolean
  includeCoreRow?: boolean
  showInstallGuidance?: boolean
  dependencySetupMode?: 'status-only' | 'expandable'
  sectionOrder?: readonly ExtensionSettingsSection[]
  onCapabilityChange: (capability: CapabilityKey, enabled: boolean) => void
  onAgentChange: (agentId: string, enabled: boolean) => void
  onAgentsNavigate?: () => void
  onTunnelSetup?: (input: TunnelSetupValues) => Promise<import('../models/controlPlane').ControlPlaneSnapshot>
  onTunnelNavigate?: () => void
  onSettingChange: (settingId: string, enabled: boolean) => void
  onDependencyInstall: (dependency: DependencyName) => void
  onOpenUrl: (url: string) => void
  onInstallerDownload: (url: string, filename: string) => void
}

export function CoreSettingControl({
  snapshot,
  pending,
  mode = 'row',
  onChange,
}: {
  snapshot: import('../models/controlPlane').ControlPlaneSnapshot | null
  pending: string | null
  mode?: 'row' | 'header'
  onChange: (enabled: boolean) => void
}): React.JSX.Element {
  const control = snapshot?.settings.find((item) => item.id === 'core')
  const checked = control?.enabled ?? false
  const disabled = control?.configurable !== true || pending !== null
  const label = t('core')

  return (
    <div className="popup-core-area" data-mode={mode}>
      {mode === 'row' ? <span className="popup-setting-name">{label}</span> : null}
      <Switch checked={checked} disabled={disabled} label={label} onChange={onChange} />
    </div>
  )
}

function AgentSummary({ agents }: { agents: Array<{ id: string; name: string }> }): React.JSX.Element {
  return (
    <span className="popup-agent-summary" aria-hidden="true">
      {agents.map((agent) => (
        <span key={agent.id} className="popup-agent-mark" title={agent.name}><AgentIcon /></span>
      ))}
    </span>
  )
}

function InstallCommand({ command }: { command: string }): React.JSX.Element {
  return (
    <div className="install-command">
      <code className="install-command__text">{command}</code>
    </div>
  )
}

export function InstallAgentHelmGuidance({
  onInstallerDownload,
}: {
  onInstallerDownload: (url: string, filename: string) => void
}): React.JSX.Element {
  const currentExtensionId = typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : null
  const extensionId = currentExtensionId ?? '<extension-id>'
  const windows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)
  const installer = windows ? fixedAgentHelmInstallerSource.windows : fixedAgentHelmInstallerSource.macos
  const installerFilename = windows
    ? installer.assetName
    : currentExtensionId ? agentHelmMacosInstallerFilename(installer.version, currentExtensionId) : installer.assetName
  const installChromeCommand = windows
    ? `& ([scriptblock]::Create((irm https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.ps1))) -Version ${extensionReleaseVersion} -ExtensionId ${extensionId}`
    : `curl -fsSL https://raw.githubusercontent.com/BeforeWave/agent-helm-extensions/main/install-chrome.sh | AGENT_HELM_CHROME_EXTENSION_ID=${extensionId} sh -s -- ${extensionReleaseVersion}`
  const repairCommand = installChromeCommand
  const downloadedInstallerPath = windows ? `%USERPROFILE%\\Downloads\\${installerFilename}` : `$HOME/Downloads/${installerFilename}`
  const gatekeeperCommand = `xattr -dr com.apple.quarantine "${downloadedInstallerPath}"\nopen "${downloadedInstallerPath}"`
  return (
    <div className="extension-install-guidance" role="status">
      <strong>{t('extensionInstallAgentHelmTitle')}</strong>
      <p>{t('extensionInstallAgentHelmDescription')}</p>
      <button
        type="button"
        className="primary-button"
        disabled={!currentExtensionId}
        onClick={() => onInstallerDownload(installer.downloadUrl, installerFilename)}
      >
        {t('extensionInstallAgentHelmDownload')}
      </button>
      {windows ? (
        <p className="extension-install-warning">{t('extensionInstallAgentHelmWindows')}</p>
      ) : (
        <>
          <p className="extension-install-warning">{t('extensionInstallAgentHelmUnsigned')}</p>
          <p className="extension-install-warning">{t('extensionInstallAgentHelmGatekeeperHint')}</p>
          <InstallCommand command={gatekeeperCommand} />
        </>
      )}
      <details>
        <summary>{t('extensionInstallAgentHelmTerminalFirst')}</summary>
        <p>{t('extensionInstallAgentHelmTerminalFirstDescription')}</p>
        <InstallCommand command={installChromeCommand} />
      </details>
      <details>
        <summary>{t('extensionInstallAgentHelmTerminalFallback')}</summary>
        <InstallCommand command={repairCommand} />
      </details>
    </div>
  )
}

export function ExtensionSettingsControls({
  snapshot,
  pending,
  loading = false,
  capabilitiesInitiallyExpanded = false,
  agentsInitiallyExpanded = false,
  agentsMode = 'accordion',
  codeSenseInitiallyExpanded = false,
  tunnelInitiallyExpanded = false,
  includeCoreRow = true,
  showInstallGuidance = false,
  dependencySetupMode = 'status-only',
  sectionOrder = DEFAULT_EXTENSION_SETTINGS_SECTION_ORDER,
  onCapabilityChange,
  onAgentChange,
  onAgentsNavigate,
  onTunnelSetup,
  onTunnelNavigate,
  onSettingChange,
  onDependencyInstall,
  onOpenUrl,
  onInstallerDownload,
}: SettingsControlsProps): React.JSX.Element {
  const [expandedSection, setExpandedSection] = useState<ExtensionSettingsSection | null>(() => {
    if (agentsMode === 'accordion' && agentsInitiallyExpanded) return 'agents'
    if (tunnelInitiallyExpanded) return 'tunnel'
    if (codeSenseInitiallyExpanded) return 'code-sense'
    if (capabilitiesInitiallyExpanded) return 'capabilities'
    return null
  })
  useEffect(() => { if (agentsMode === 'accordion' && agentsInitiallyExpanded) setExpandedSection('agents') }, [agentsInitiallyExpanded, agentsMode])
  useEffect(() => { if (tunnelInitiallyExpanded) setExpandedSection('tunnel') }, [tunnelInitiallyExpanded])
  useEffect(() => { if (codeSenseInitiallyExpanded) setExpandedSection('code-sense') }, [codeSenseInitiallyExpanded])
  useEffect(() => { if (capabilitiesInitiallyExpanded) setExpandedSection('capabilities') }, [capabilitiesInitiallyExpanded])
  const toggleSection = (section: ExtensionSettingsSection) => setExpandedSection((current) => current === section ? null : section)
  const [tunnelId, setTunnelId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [runtimeApiKey, setRuntimeApiKey] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const core = snapshot?.settings.find((setting) => setting.id === 'core')
  const externalAgentLsp = snapshot?.settings.find((setting) => setting.id === 'external-agent-lsp') ?? (loading ? {
    id: 'external-agent-lsp',
    label: t('externalAgentLsp'),
    kind: 'toggle' as const,
    state: 'unavailable' as const,
    enabled: true,
    configurable: false,
  } : undefined)
  const localAgentLsp = snapshot?.settings.find((setting) => setting.id === 'local-agent-lsp') ?? (loading ? {
    id: 'local-agent-lsp',
    label: t('localMcp'),
    kind: 'toggle' as const,
    state: 'unavailable' as const,
    enabled: false,
    configurable: false,
  } : undefined)
  const tunnel = snapshot?.settings.find((setting) => setting.id === 'tunnel') ?? (loading ? {
    id: 'tunnel',
    label: t('tunnel'),
    kind: 'status' as const,
    state: 'unavailable' as const,
  } : undefined)
  const serenaDependency = snapshot?.dependencies.serena
  const tunnelDependency = snapshot?.dependencies.tunnelClient
  const childControlsDisabled = loading || core?.enabled !== true || pending === 'setting:core'

  const enabledCapabilities = deriveHelmCapabilitySummary({
    understand: snapshot?.capabilities.understand.enabled ?? false,
    coding: snapshot?.capabilities.code.enabled ?? false,
    command: snapshot?.capabilities.command.enabled ?? false,
  }).map(({ id, icon, labelKey }) => ({
    key: (id === 'coding' ? 'code' : id) as CapabilityKey,
    icon,
    label: t(labelKey),
  }))
  const enabledAgents = snapshot?.agents.filter((agent) => agent.enabled) ?? []
  const agentsExpandable = (snapshot?.agents.length ?? 0) > 0
  const [agentHelmStep, openAiStep, chatGptStep] = tunnelOnboardingSource.steps

  const seedTunnelFields = () => {
    setTunnelId(tunnel?.tunnelId ?? '')
    setOrganizationId(tunnel?.organizationId ?? '')
    setRuntimeApiKey('')
    setProxyUrl(tunnel?.proxyUrl ?? '')
  }


  const toggleTunnel = () => {
    const opening = expandedSection !== 'tunnel'
    if (opening) seedTunnelFields()
    setExpandedSection(opening ? 'tunnel' : null)
  }

  const submitTunnel = async () => {
    if (!onTunnelSetup) return
    const input: TunnelSetupValues = {
      tunnelId,
      ...(organizationId.trim() ? { organizationId } : {}),
      ...(runtimeApiKey.trim() ? { apiKey: runtimeApiKey } : {}),
      proxyUrl,
    }
    try {
      await onTunnelSetup(input)
      setRuntimeApiKey('')
    } catch {
      // The parent owns the visible Core error; keep the form open and preserve the entered key.
    }
  }

  const renderSection = (section: ExtensionSettingsSection): React.JSX.Element | null => {
    if (section === 'capabilities') {
      return (
        <Accordion
          key={section}
          title={t('capabilityGroup')}
          expanded={expandedSection === 'capabilities'}
          disabled={loading}
          onToggle={() => toggleSection('capabilities')}
          summary={<CapabilitySummary items={enabledCapabilities} />}
        >
          {CAPABILITIES.map((definition) => {
            const state = snapshot?.capabilities[definition.key]
            return (
              <div key={definition.key} className="popup-subrow">
                <span className="popup-subrow__name"><span aria-hidden="true">{definition.icon}</span>{t(definition.labelKey)}</span>
                <Switch
                  checked={state?.enabled ?? false}
                  disabled={childControlsDisabled || !state?.available || pending !== null}
                  label={t(definition.toggleKey)}
                  onChange={(enabled) => onCapabilityChange(definition.key, enabled)}
                />
              </div>
            )
          })}
        </Accordion>
      )
    }

    if (section === 'agents') {
      if (agentsMode === 'navigate') {
        return (
          <button key={section} type="button" className="popup-setting-row" onClick={onAgentsNavigate} disabled={!onAgentsNavigate}>
            <span className="popup-setting-name">{t('extensionAgents')}</span>
            <span className="popup-setting-controls">
              {agentsExpandable ? <AgentSummary agents={enabledAgents} /> : null}
              <span className="popup-panel-entry__arrow" aria-hidden="true">›</span>
            </span>
          </button>
        )
      }
      return (
        <Accordion
          key={section}
          title={t('extensionAgents')}
          expanded={expandedSection === 'agents'}
          disabled={loading}
          onToggle={() => toggleSection('agents')}
          summary={agentsExpandable ? <AgentSummary agents={enabledAgents} /> : undefined}
        >
          {(snapshot?.agents ?? []).length === 0 ? (
            <div className="popup-subrow"><span className="popup-subrow__name">{t('extensionNoLocalAgent')}</span></div>
          ) : (snapshot?.agents ?? []).map((agent) => (
            <div key={agent.id} className="popup-subrow">
              <span className="popup-subrow__name">
                <span className="popup-agent-mark" aria-hidden="true"><AgentIcon /></span>
                {agent.name}
              </span>
              <Switch
                checked={agent.enabled}
                disabled={childControlsDisabled || !agent.configurable || pending !== null}
                label={agent.name}
                onChange={(enabled) => onAgentChange(agent.id, enabled)}
              />
            </div>
          ))}
        </Accordion>
      )
    }

    if (section === 'code-sense') {
      if (!externalAgentLsp && !localAgentLsp) return null
      const serenaUnavailable = serenaDependency?.state === 'unavailable'
      const issue = serenaUnavailable
        ? `${t('serenaDependencyIssue')}: ${serenaDependency.installCommand ? t('serenaInstallDescription') : t('serenaManualDescription')}`
        : externalAgentLsp?.message ?? localAgentLsp?.message
      const codeSenseState: import('../models/controlPlane').RuntimeState = serenaUnavailable
        ? 'error'
        : serenaDependency?.state === 'ready' || serenaDependency?.state === 'running'
          ? 'running'
          : 'stopped'
      const dependencySetupVisible = dependencySetupMode === 'expandable' && serenaUnavailable
      return (
        <Accordion
          key={section}
          title={t('codeSense')}
          expanded={expandedSection === 'code-sense'}
          disabled={loading}
          onToggle={() => toggleSection('code-sense')}
          summary={(
            <span className="popup-runtime-state" role="img" title={issue} aria-label={issue ?? runtimeStateLabel(codeSenseState)}>
              <StatusDot state={codeSenseState} />
            </span>
          )}
        >
          {externalAgentLsp ? (
            <div className="popup-subrow">
              <span className="popup-subrow__name">{externalAgentLsp.label}</span>
              <Switch
                checked={!serenaUnavailable && (externalAgentLsp.enabled ?? false)}
                disabled={serenaUnavailable || childControlsDisabled || !externalAgentLsp.configurable || pending !== null}
                label={t('toggleExternalAgentLsp')}
                onChange={(enabled) => onSettingChange(externalAgentLsp.id, enabled)}
              />
            </div>
          ) : null}
          {localAgentLsp ? (
            <div className="popup-subrow">
              <span className="popup-subrow__name">{localAgentLsp.label}</span>
              <Switch
                checked={!serenaUnavailable && (localAgentLsp.enabled ?? false)}
                disabled={serenaUnavailable || childControlsDisabled || !localAgentLsp.configurable || pending !== null}
                label={t('toggleLocalMcp')}
                onChange={(enabled) => onSettingChange(localAgentLsp.id, enabled)}
              />
            </div>
          ) : null}
          {dependencySetupVisible ? (
            <div className="dependency-setup-panel" role="status">
              <strong className="dependency-setup-title">{t('serenaDependencyIssue')}</strong>
              <p className="dependency-setup-error">{serenaDependency.installCommand ? t('serenaInstallDescription') : t('serenaManualDescription')}</p>
              {serenaDependency.installCommand ? <InstallCommand command={serenaDependency.installCommand} /> : null}
              <div className="dependency-setup-actions">
                {serenaDependency.installCommand ? (
                  <button type="button" className="primary-button" disabled={pending !== null} onClick={() => onDependencyInstall('serena')}>
                    {pending === 'dependency:serena' ? t('installing') : t('install')}
                  </button>
                ) : null}
                {serenaDependency.installUrl ? (
                  <button
                    type="button"
                    className={serenaDependency.installCommand ? 'secondary-button' : 'primary-button'}
                    onClick={() => onOpenUrl(serenaDependency.installUrl!)}
                  >
                    {serenaDependency.installCommand ? t('manualSetup') : t('goInstall')}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </Accordion>
      )
    }

    if (!tunnel) return null
    const tunnelIssue = tunnel.message ?? (tunnelDependency?.state === 'unavailable' ? t(openAiStep.dependency.required.key) : undefined)
    const tunnelStatusState = tunnelIssue || tunnel.state === 'unavailable' || tunnel.state === 'error' ? 'error' : tunnel.state
    const summary = (
      <span className="popup-runtime-state" role="img" title={tunnelIssue} aria-label={tunnelIssue ?? runtimeStateLabel(tunnel.state)}>
        <StatusDot state={tunnelStatusState} />
      </span>
    )

    if (!onTunnelSetup) {
      const content = <span className="popup-setting-name">{tunnel.label}{summary}</span>
      const tunnelAction = onTunnelNavigate ?? (tunnel.adminUrl ? () => onOpenUrl(tunnel.adminUrl!) : undefined)
      return tunnelAction ? (
        <button key={section} type="button" className="popup-setting-row" onClick={tunnelAction}>
          {content}
          <span className="popup-panel-entry__arrow" aria-hidden="true">›</span>
        </button>
      ) : (
        <div key={section} className="popup-setting-row">{content}</div>
      )
    }

    return (
      <Accordion
        key={section}
        title={tunnel.label}
        expanded={expandedSection === 'tunnel'}
        disabled={loading}
        onToggle={toggleTunnel}
        onTitleClick={tunnel.adminUrl ? () => onOpenUrl(tunnel.adminUrl!) : undefined}
        summary={summary}
      >
        <div className="tunnel-setup-panel">
          {tunnel.message ? <p className="tunnel-setup-error">{tunnel.message}</p> : null}

          <section className="tunnel-setup-step">
            <strong>{t(agentHelmStep.title.key)}</strong>

            <div className="tunnel-setup-field">
              <span className="tunnel-setup-field__label">{t(agentHelmStep.fields[0].label.key)} <TunnelFieldInfo label={t(agentHelmStep.fields[0].description.key)} /></span>
              <div className="tunnel-setup-field__control">
                <input value={tunnelId} onChange={(event) => setTunnelId(event.currentTarget.value)} autoComplete="off" spellCheck={false} />
                <button type="button" className="text-link tunnel-external-link" onClick={() => onOpenUrl(agentHelmStep.fields[0].helpLink.href)}>{t('fieldGet')} <span aria-hidden="true">↗</span></button>
              </div>
            </div>

            <div className="tunnel-setup-field">
              <span className="tunnel-setup-field__label">{t(agentHelmStep.fields[1].label.key)} <TunnelFieldInfo label={t(agentHelmStep.fields[1].description.key)} /></span>
              <div className="tunnel-setup-field__control">
                <input
                  type="password"
                  value={runtimeApiKey}
                  placeholder={tunnel.apiKeyConfigured ? t(agentHelmStep.fields[1].savedPlaceholder.key) : undefined}
                  onChange={(event) => setRuntimeApiKey(event.currentTarget.value)}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <button type="button" className="text-link tunnel-external-link" onClick={() => onOpenUrl(agentHelmStep.fields[1].helpLink.href)}>{t('fieldGet')} <span aria-hidden="true">↗</span></button>
              </div>
            </div>
            <div className="tunnel-setup-field">
              <span className="tunnel-setup-field__label">{t(agentHelmStep.fields[2].label.key)} <TunnelFieldInfo label={t(agentHelmStep.fields[2].description.key)} /></span>
              <div className="tunnel-setup-field__control">
                <input value={organizationId} onChange={(event) => setOrganizationId(event.currentTarget.value)} autoComplete="off" spellCheck={false} />
                <button type="button" className="text-link tunnel-external-link" onClick={() => onOpenUrl(agentHelmStep.fields[2].helpLink.href)}>{t('fieldGet')} <span aria-hidden="true">↗</span></button>
              </div>
            </div>

            <label className="tunnel-setup-field">
              <span className="tunnel-setup-field__label">{t(agentHelmStep.fields[3].label.key)} <TunnelFieldInfo label={t(agentHelmStep.fields[3].description.key)} /></span>
              <div className="tunnel-setup-field__control">
                <input
                  value={proxyUrl}
                  placeholder={t(agentHelmStep.fields[3].savedPlaceholder.key)}
                  onChange={(event) => setProxyUrl(event.currentTarget.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </label>
            <div className="tunnel-setup-actions">
              <button
                type="button"
                className="primary-button"
                disabled={pending !== null || !tunnelSetupCanSubmit({ tunnelId, apiKeyConfigured: tunnel.apiKeyConfigured ?? false, runtimeApiKey })}
                onClick={() => { void submitTunnel() }}
              >
                {pending === 'tunnel:setup' ? t(agentHelmStep.submitting.key) : tunnelDependency?.state === 'unavailable' ? t(agentHelmStep.saveAction.key) : t(agentHelmStep.submitAction.key)}
              </button>
              {tunnelDependency?.state === 'unavailable' ? (
                <button type="button" className="secondary-button" disabled={pending !== null} onClick={() => onDependencyInstall('tunnelClient')}>
                  {pending === 'dependency:tunnelClient' ? t(openAiStep.dependency.installing.key) : t(openAiStep.dependency.installAction.key)}
                </button>
              ) : (
                <button type="button" className="secondary-button" disabled>{t(openAiStep.dependency.installedAction.key)}</button>
              )}
            </div>
          </section>

          <section className="tunnel-setup-step">
            <strong>{t(openAiStep.title.key)}</strong>
            <p className="tunnel-setup-copy">{t(openAiStep.description.key)}</p>
            <div className="tunnel-setup-links">
              <button type="button" className="text-link tunnel-external-link" onClick={() => onOpenUrl(tunnel.installUrl ?? openAiStep.dependency.downloadAction.href)}>{t(openAiStep.dependency.downloadAction.label.key)} <span aria-hidden="true">↗</span></button>
            </div>
          </section>

          <section className="tunnel-setup-step">
            <strong>{t(chatGptStep.title.key)}</strong>
            <p className="tunnel-setup-copy">{t(chatGptStep.description.key)}</p>
            <div className="tunnel-setup-links">
              <button type="button" className="text-link tunnel-external-link" onClick={() => onOpenUrl(chatGptStep.links[0].href)}>{t(chatGptStep.links[0].label.key)} <span aria-hidden="true">↗</span></button>
              <button type="button" className="text-link tunnel-external-link" onClick={() => onOpenUrl(chatGptStep.links[1].href)}>{t(chatGptStep.links[1].label.key)} <span aria-hidden="true">↗</span></button>
            </div>
          </section>
        </div>
      </Accordion>
    )
  }

  return (
    <div className="popup-control-plane">
      {showInstallGuidance && snapshot?.connection.state === 'install-required' ? <InstallAgentHelmGuidance onInstallerDownload={onInstallerDownload} /> : null}
      {includeCoreRow ? (
        <CoreSettingControl
          snapshot={snapshot}
          pending={pending}
          onChange={(enabled) => onSettingChange('core', enabled)}
        />
      ) : null}
      {sectionOrder.map(renderSection)}
    </div>
  )
}
