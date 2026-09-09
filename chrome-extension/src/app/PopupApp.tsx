import { useState } from 'react'
import type { BrowserControlPlaneClient } from '../client/BrowserControlPlaneClient'
import { t } from '../locale'
import type { CapabilityKey, DependencyName } from '../models/controlPlane'
import type { BrowserSettingsSection } from '../models/adapters'
import { useControlPlaneSnapshot } from '../features/useControlPlane'



import {
  ExtensionSettingsControls as SharedExtensionSettingsControls,
} from '../components/ExtensionSettingsControls'


import { deriveExtensionConnectionPresentation } from '../models/controlPlane'
import { ExtensionConnectionStatus } from '../components/Status'

import { CoreSettingControl } from '../components/ExtensionSettingsControls'
import { LoadingSurface } from '../components/LoadingSurface'

export function PopupApp({ client }: { client: BrowserControlPlaneClient }): React.JSX.Element {
  const { snapshot, setSnapshot, error, setError, loading } = useControlPlaneSnapshot(client)
  const [pending, setPending] = useState<string | null>(null)

  const mutate = async (key: string, operation: () => ReturnType<BrowserControlPlaneClient['getSnapshot']>) => {
    setPending(key)
    try {
      setSnapshot(await operation())
      setError(null)
      void chrome.runtime.sendMessage({ type: 'agent-helm:refresh-action-status' }).catch(() => {})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      void chrome.runtime.sendMessage({ type: 'agent-helm:refresh-action-status' }).catch(() => {})
    } finally {
      setPending(null)
    }
  }

  const toggleCapability = (capability: CapabilityKey, enabled: boolean) => {
    void mutate(`capability:${capability}`, () => client.setCapability(capability, enabled))
  }

  const toggleAgent = (agentId: string, enabled: boolean) => {
    void mutate(`agent:${agentId}`, () => client.setAgentEnabled(agentId, enabled))
  }

  const toggleSetting = (settingId: string, enabled: boolean) => {
    void mutate(`setting:${settingId}`, () => client.setSetting(settingId, enabled))
  }

  const installDependency = (dependency: DependencyName) => {
    void mutate('dependency:' + dependency, () => client.installDependency(dependency))
  }

  const openUrl = (url: string) => {
    void client.openExternalUrl(url).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
  }

  const presentation = deriveExtensionConnectionPresentation(snapshot, !snapshot && error ? error : null)
  const coreIssue = snapshot?.settings.find((setting) => setting.id === 'core')?.message
  const visibleIssue = error ?? coreIssue

  const openPanel = async (section?: BrowserSettingsSection) => {
    try {
      await client.openSidePanel(section)
      client.closePopup()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div className="popup-shell">
      <div className="popup-card">
        <div className="popup-setting-row">
          <span className="popup-setting-name">Agent Helm Service</span>
          <CoreSettingControl
            snapshot={snapshot}
            pending={pending}
            mode="header"
            onChange={(enabled) => toggleSetting('core', enabled)}
          />
        </div>

        {visibleIssue ? <div className="error-banner">{visibleIssue}</div> : null}
        <LoadingSurface loading={loading && !snapshot} label={t('loading')}>
          <SharedExtensionSettingsControls
            snapshot={snapshot}
            loading={loading && !snapshot}
            pending={pending}
            includeCoreRow={false}
            showInstallGuidance
            sectionOrder={['capabilities', 'code-sense', 'tunnel', 'agents']}
            onCapabilityChange={toggleCapability}
            onAgentChange={toggleAgent}
            agentsMode="navigate"
            onAgentsNavigate={() => { void openPanel('agents') }}
            onTunnelNavigate={() => { void openPanel('tunnel') }}
            onSettingChange={toggleSetting}
            onDependencyInstall={installDependency}
            onOpenUrl={openUrl}
            onInstallerDownload={(url, filename) => {
              void client.downloadFile(url, filename).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
            }}
          />
        </LoadingSurface>
      </div>

      <button type="button" className="popup-panel-entry" onClick={() => { void openPanel() }}>
        <span>{t('extensionOpenAgentHelm')}</span>
        <span className="popup-panel-entry__meta">
          <ExtensionConnectionStatus presentation={presentation} />
          <span className="popup-panel-entry__arrow" aria-hidden="true">›</span>
        </span>
      </button>
    </div>
  )
}
