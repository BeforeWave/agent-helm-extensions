import { McpServersManager, type McpServersLabels } from '../__shared/mcp-servers-ui/index'
import { t } from '../locale'
import type { ExternalMcpServer } from '../models/adapters'

export function ExternalMcpControls({
  list, scan, importServer, setEnabled, configure, configureHeaders, configureOAuth, authorize, disabled = false,
}: {
  list: () => Promise<ExternalMcpServer[]>
  scan: () => Promise<import('../models/adapters').ExternalMcpScanResult>
  importServer: (id: string) => Promise<ExternalMcpServer[]>
  setEnabled: (id: string, enabled: boolean) => Promise<ExternalMcpServer[]>
  configure: (id: string, values: Record<string, string>) => Promise<ExternalMcpServer[]>
  configureHeaders: (id: string, headers: Record<string, string>) => Promise<ExternalMcpServer[]>
  configureOAuth: (id: string, options: import('../models/adapters').OAuthClientSetup) => Promise<ExternalMcpServer[]>
  authorize: (id: string) => Promise<{ authorizationUrl?: string }>
  disabled?: boolean
}): React.JSX.Element {
  const labels: McpServersLabels = {
    myServers: t('externalMcpMyServers'), discover: t('externalMcpDiscover'),
    scan: t('externalMcpScan'), scanFailed: t('externalMcpScanFailed'), import: t('externalMcpImport'),
    loading: t('loading'), empty: t('externalMcpEmpty'),
    notScanned: t('externalMcpNotScanned'), noneFound: t('externalMcpNoneFound'),
    saveEnv: t('externalMcpSaveEnv'), authorize: t('externalMcpAuthorize'), openAuth: t('externalMcpOpenAuth'),
    advancedAuth: t('externalMcpAdvancedAuth'),
    authAuto: t('externalMcpAuthAuto'), authMetadata: t('externalMcpAuthMetadata'),
    authRegistered: t('externalMcpAuthRegistered'), authMachine: t('externalMcpAuthMachine'),
    oauthClientId: t('externalMcpOauthClientId'), oauthClientSecret: t('externalMcpOauthClientSecret'),
    oauthMetadataUrl: t('externalMcpOauthMetadataUrl'), oauthScope: t('externalMcpOauthScope'), oauthSave: t('externalMcpOauthSave'),
    httpHeader: t('externalMcpHttpHeader'), httpHeaderName: t('externalMcpHttpHeaderName'), httpHeaderValue: t('externalMcpHttpHeaderValue'), httpHeaderSave: t('externalMcpHttpHeaderSave'),

    statuses: {
      discovered: t('externalMcpDiscovered'), imported: t('externalMcpImported'),
      enabled: t('externalMcpEnabled'), connected: t('externalMcpConnected'),
      'auth-required': t('externalMcpAuthRequired'), 'needs-config': t('externalMcpNeedsConfig'),
      unavailable: t('externalMcpUnavailable'), error: t('externalMcpError'),
    },
    issues: {
      'missing-env': t('externalMcpMissingEnv'), 'remote-auth': t('externalMcpRemoteAuth'),
      'insecure-http': t('externalMcpInsecureHttp'),
    },
  }
  return <McpServersManager labels={labels} disabled={disabled}
    adapter={{ list, scan, importServer, setEnabled, configure, configureHeaders, configureOAuth, authorize }} />
}
