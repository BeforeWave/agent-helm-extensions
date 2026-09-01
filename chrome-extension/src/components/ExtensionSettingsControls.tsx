import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { StatusDot } from '../components/Status'
import { Switch } from '../components/Switch'
import { runtimeStateLabel, t } from '../locale'
import type { CapabilityKey, DependencyName } from '../models/controlPlane'
import uiContractManifest from '@beforewave/agent-helm-ui-contract/package.json'
import { agentHelmInstallerSourceForRelease, agentHelmMacosInstallerFilename, loadAgentHelmInstallerSource, tunnelOnboardingRequired, tunnelOnboardingSource, tunnelSetupCanSubmit, type TunnelSetupValues } from '@beforewave/agent-helm-ui-contract'

import { Accordion } from '../components/Accordion'

import {
  deriveHelmCapabilitySummary,
  helmCapabilityDefinitions,
  shouldCompactHelmCapabilitySummary,
} from '../models/presentation'

const fallbackAgentHelmInstallerSource = agentHelmInstallerSourceForRelease(uiContractManifest.version)

const CAPABILITIES = helmCapabilityDefinitions.map((definition) => ({
  ...definition,
  key: (definition.id === 'coding' ? 'code' : definition.id) as CapabilityKey,
}))

type CapabilitySummaryItem = { icon: string; label: string }

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

export type ExtensionSettingsSection = 'capabilities' | 'agents' | 'local-agent-lsp' | 'tunnel'

export const DEFAULT_EXTENSION_SETTINGS_SECTION_ORDER: readonly ExtensionSettingsSection[] = [
  'capabilities',
  'agents',
  'local-agent-lsp',
  'tunnel',
]

type SettingsControlsProps = {
  snapshot: import('../models/controlPlane').ControlPlaneSnapshot | null
  pending: string | null
  capabilitiesInitiallyExpanded?: boolean
  agentsInitiallyExpanded?: boolean
  includeCoreRow?: boolean
  showInstallGuidance?: boolean
  sectionOrder?: readonly ExtensionSettingsSection[]
  onCapabilityChange: (capability: CapabilityKey, enabled: boolean) => void
  onAgentChange: (agentId: string, enabled: boolean) => void
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

function agentLogoLabel(agent: { id: string; name: string; logo?: string }): string {
  if (agent.logo) return agent.logo
  const words = agent.name.trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase()
  return (words[0] ?? agent.id).slice(0, 3).toUpperCase()
}

function AgentSummary({ agents }: { agents: Array<{ id: string; name: string; logo?: string }> }): React.JSX.Element {
  return (
    <span className="popup-agent-summary" aria-hidden="true">
      {agents.map((agent) => (
        <span key={agent.id} className="popup-agent-mark" title={agent.name}>{agentLogoLabel(agent)}</span>
      ))}
    </span>
  )
}

export function InstallAgentHelmGuidance({
  onInstallerDownload,
}: {
  onInstallerDownload: (url: string, filename: string) => void
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [agentHelmInstallerSource, setAgentHelmInstallerSource] = useState(fallbackAgentHelmInstallerSource)
  const [installerSourceResolved, setInstallerSourceResolved] = useState(false)
  useEffect(() => {
    let active = true
    const compatibilityUrl = import.meta.env.WXT_AGENT_HELM_COMPATIBILITY_URL?.trim()
    const expectedReleaseUrl = import.meta.env.WXT_AGENT_HELM_RELEASE_URL?.trim()
    void loadAgentHelmInstallerSource({
      ...(compatibilityUrl ? { compatibilityUrl } : {}),
      ...(expectedReleaseUrl ? { expectedReleaseUrl } : {}),
    })
      .then((source) => { if (active) setAgentHelmInstallerSource(source) })
      .catch(() => {})
      .finally(() => { if (active) setInstallerSourceResolved(true) })
    return () => { active = false }
  }, [])
  const currentExtensionId = typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : null
  const extensionId = currentExtensionId ?? '<extension-id>'
  const installer = agentHelmInstallerSource.macos
  const installerFilename = currentExtensionId ? agentHelmMacosInstallerFilename(installer.version, currentExtensionId) : installer.assetName
  const installScriptUrl = import.meta.env.WXT_AGENT_HELM_INSTALL_SCRIPT_URL?.trim() || `https://unpkg.com/@beforewave/agent-helm@${installer.version}/install.sh`
  const command = `curl -fsSL ${installScriptUrl} | AGENT_HELM_CHROME_EXTENSION_ID=${extensionId} AGENT_HELM_VERSION=${installer.version} sh`
  const copy = () => {
    void navigator.clipboard?.writeText(command).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div className="extension-install-guidance" role="status">
      <strong>{t('extensionInstallAgentHelmTitle')}</strong>
      <p>{t('extensionInstallAgentHelmDescription')}</p>
      <button
        type="button"
        className="primary-button"
        disabled={!currentExtensionId || !installerSourceResolved}
        onClick={() => onInstallerDownload(installer.downloadUrl, installerFilename)}
      >
        {t('extensionInstallAgentHelmDownload')}
      </button>
      <p className="extension-install-warning">{t('extensionInstallAgentHelmUnsigned')}</p>
      <details>
        <summary>{t('extensionInstallAgentHelmTerminalFallback')}</summary>
        <pre>{command}</pre>
        <button type="button" className="secondary-button" onClick={copy}>
          {t(copied ? 'extensionInstallAgentHelmCopied' : 'extensionInstallAgentHelmCopy')}
        </button>
      </details>
    </div>
  )
}

export function ExtensionSettingsControls({
  snapshot,
  pending,
  capabilitiesInitiallyExpanded = false,
  agentsInitiallyExpanded = false,
  includeCoreRow = true,
  showInstallGuidance = false,
  sectionOrder = DEFAULT_EXTENSION_SETTINGS_SECTION_ORDER,
  onCapabilityChange,
  onAgentChange,
  onTunnelSetup,
  onTunnelNavigate,
  onSettingChange,
  onDependencyInstall,
  onOpenUrl,
  onInstallerDownload,
}: SettingsControlsProps): React.JSX.Element {
  const [capabilitiesExpanded, setCapabilitiesExpanded] = useState(capabilitiesInitiallyExpanded)
  const [agentsExpanded, setAgentsExpanded] = useState(agentsInitiallyExpanded)
  const [tunnelExpanded, setTunnelExpanded] = useState(false)
  const [tunnelId, setTunnelId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [runtimeApiKey, setRuntimeApiKey] = useState('')
  const tunnelOnboardingAutoOpened = useRef(false)
  const core = snapshot?.settings.find((setting) => setting.id === 'core')
  const localAgentLsp = snapshot?.settings.find((setting) => setting.id === 'local-agent-lsp')
  const tunnel = snapshot?.settings.find((setting) => setting.id === 'tunnel')
  const serenaDependency = snapshot?.dependencies.serena
  const tunnelDependency = snapshot?.dependencies.tunnelClient
  const childControlsDisabled = core?.enabled !== true || pending === 'setting:core'

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
  const [openAiStep, agentHelmStep, chatGptStep] = tunnelOnboardingSource.steps
  const needsTunnelSetup = Boolean(tunnel && tunnelOnboardingRequired({ tunnelId: tunnel.tunnelId, apiKeyConfigured: tunnel.apiKeyConfigured ?? false, missingEnvironment: tunnel.missingEnvironment }))

  const seedTunnelFields = () => {
    setTunnelId(tunnel?.tunnelId ?? '')
    setOrganizationId(tunnel?.organizationId ?? '')
    setRuntimeApiKey('')
  }

  useEffect(() => {
    if (!onTunnelSetup || !needsTunnelSetup || tunnelOnboardingAutoOpened.current) return
    tunnelOnboardingAutoOpened.current = true
    seedTunnelFields()
    setTunnelExpanded(true)
  }, [needsTunnelSetup, onTunnelSetup, tunnel?.organizationId, tunnel?.tunnelId])

  const toggleTunnel = () => {
    setTunnelExpanded((current) => {
      const next = !current
      if (next) seedTunnelFields()
      return next
    })
  }

  const submitTunnel = async () => {
    if (!onTunnelSetup) return
    const input: TunnelSetupValues = {
      tunnelId,
      ...(organizationId.trim() ? { organizationId } : {}),
      ...(runtimeApiKey.trim() ? { apiKey: runtimeApiKey } : {}),
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
          expanded={capabilitiesExpanded}
          onToggle={() => setCapabilitiesExpanded((current) => !current)}
          summary={<CapabilitySummary items={enabledCapabilities} />}
        >
          {CAPABILITIES.map((definition) => {
            const state = snapshot?.capabilities[definition.key]
            return (
              <div key={definition.key} className="popup-subrow">
                <span className="popup-subrow__name"><span aria-hidden="true">{definition.icon}</span>{t(definition.labelKey)}</span>
                {definition.key === 'understand' && serenaDependency?.state === 'unavailable' ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={pending !== null}
                    onClick={() => {
                      if (serenaDependency.installCommand) onDependencyInstall('serena')
                      else if (serenaDependency.installUrl) onOpenUrl(serenaDependency.installUrl)
                    }}
                  >
                    {serenaDependency.installCommand ? t('install') : t('goInstall')}
                  </button>
                ) : null}
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
      return (
        <Accordion
          key={section}
          title="Agents"
          expanded={agentsExpanded}
          disabled={!agentsExpandable}
          onToggle={() => setAgentsExpanded((current) => !current)}
          summary={<AgentSummary agents={enabledAgents} />}
        >
          {(snapshot?.agents ?? []).map((agent) => (
            <div key={agent.id} className="popup-subrow">
              <span className="popup-subrow__name">
                <span className="popup-agent-mark" aria-hidden="true">{agentLogoLabel(agent)}</span>
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

    if (section === 'local-agent-lsp') {
      if (!localAgentLsp) return null
      return (
        <div key={section} className="popup-setting-row">
          <span className="popup-setting-name">{localAgentLsp.label}</span>
          <Switch
            checked={localAgentLsp.enabled ?? false}
            disabled={childControlsDisabled || !localAgentLsp.configurable || pending !== null}
            label={localAgentLsp.label}
            onChange={(enabled) => onSettingChange(localAgentLsp.id, enabled)}
          />
        </div>
      )
    }

    if (!tunnel) return null
    const tunnelText = tunnel.message || runtimeStateLabel(tunnel.state)
    const summary = (
      <span className="popup-runtime-state" title={tunnel.message}>
        <StatusDot state={tunnel.state} />
        {tunnelText ? <span>{tunnelText}</span> : null}
      </span>
    )

    if (!onTunnelSetup) {
      const content = <><span className="popup-setting-name">{tunnel.label}</span>{summary}</>
      return onTunnelNavigate ? (
        <button key={section} type="button" className="popup-setting-row" onClick={onTunnelNavigate}>{content}</button>
      ) : (
        <div key={section} className="popup-setting-row">{content}</div>
      )
    }

    return (
      <Accordion key={section} title={tunnel.label} expanded={tunnelExpanded} onToggle={toggleTunnel} summary={summary}>
        <div className="tunnel-setup-panel">
          <p className="tunnel-setup-copy">{t(tunnelOnboardingSource.description.key)}</p>
          {tunnel.message ? <p className="tunnel-setup-error">{tunnel.message}</p> : null}

          <section className="tunnel-setup-step">
            <strong>{t(openAiStep.title.key)}</strong>
            <p className="tunnel-setup-copy">{t(openAiStep.description.key)}</p>
            {tunnelDependency?.state === 'unavailable' ? (<>
              <p className="tunnel-setup-error">{t(openAiStep.dependency.required.key)}</p>
              <p className="tunnel-setup-copy">{t(openAiStep.dependency.installDescription.key)}</p>
            </>) : null}
            <div className="tunnel-setup-links">
              <button type="button" className="secondary-button" onClick={() => onOpenUrl(openAiStep.links[0].href)}>{t(openAiStep.links[0].label.key)}</button>
              <button type="button" className="secondary-button" onClick={() => onOpenUrl(openAiStep.links[1].href)}>{t(openAiStep.links[1].label.key)}</button>
              <button type="button" className="secondary-button" onClick={() => onOpenUrl(openAiStep.links[2].href)}>{t(openAiStep.links[2].label.key)}</button>
              {tunnelDependency?.state === 'unavailable' ? <button type="button" className="primary-button" disabled={pending !== null} onClick={() => onDependencyInstall('tunnelClient')}>{pending === 'tunnel:install' || pending === 'dependency:tunnelClient' ? t(openAiStep.dependency.installing.key) : t(openAiStep.dependency.installAction.key)}</button> : null}
              <button type="button" className="secondary-button" onClick={() => onOpenUrl(tunnel.installUrl ?? openAiStep.dependency.downloadAction.href)}>{t(openAiStep.dependency.downloadAction.label.key)}</button>
            </div>
          </section>

          <section className="tunnel-setup-step">
            <strong>{t(agentHelmStep.title.key)}</strong>
            <p className="tunnel-setup-copy">{t(agentHelmStep.description.key)}</p>
            <label className="tunnel-setup-field">
              <span>{t(agentHelmStep.fields[0].label.key)}</span>
              <input value={tunnelId} onChange={(event) => setTunnelId(event.currentTarget.value)} autoComplete="off" spellCheck={false} />
            </label>
            <label className="tunnel-setup-field">
              <span>{t(agentHelmStep.fields[1].label.key)}</span>
              <input value={organizationId} onChange={(event) => setOrganizationId(event.currentTarget.value)} autoComplete="off" spellCheck={false} />
            </label>
            <label className="tunnel-setup-field">
              <span>{t(agentHelmStep.fields[2].label.key)}</span>
              <input
                type="password"
                value={runtimeApiKey}
                placeholder={tunnel.apiKeyConfigured ? t(agentHelmStep.fields[2].savedPlaceholder.key) : undefined}
                onChange={(event) => setRuntimeApiKey(event.currentTarget.value)}
                autoComplete="new-password"
                spellCheck={false}
              />
            </label>
            <p className="tunnel-setup-copy">{tunnel.apiKeyConfigured ? t(agentHelmStep.configuredNote.key) : t(agentHelmStep.missingNote.key)}</p>
            <p className="tunnel-setup-copy">{t(agentHelmStep.storageNote.key)}</p>
            <div className="tunnel-setup-actions">
              <button
                type="button"
                className="primary-button"
                disabled={pending !== null || !tunnelSetupCanSubmit({ tunnelId, apiKeyConfigured: tunnel.apiKeyConfigured ?? false, runtimeApiKey })}
                onClick={() => { void submitTunnel() }}
              >
                {pending === 'tunnel:setup' ? t(agentHelmStep.submitting.key) : t(agentHelmStep.submitAction.key)}
              </button>
            </div>
          </section>

          <section className="tunnel-setup-step">
            <strong>{t(chatGptStep.title.key)}</strong>
            <p className="tunnel-setup-copy">{t(chatGptStep.description.key)}</p>
            <div className="tunnel-setup-actions">
              <button type="button" className="secondary-button" onClick={() => onOpenUrl(chatGptStep.links[0].href)}>{t(chatGptStep.links[0].label.key)}</button>
              <button type="button" className="secondary-button" onClick={() => onOpenUrl(chatGptStep.links[1].href)}>{t(chatGptStep.links[1].label.key)}</button>
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
