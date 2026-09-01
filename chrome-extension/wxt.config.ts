import { defineConfig } from 'wxt'

const privateReleaseKey = process.env.AGENT_HELM_PRIVATE_CHROME_PUBLIC_KEY?.trim()
const uatCompatibilityUrl = process.env.WXT_AGENT_HELM_COMPATIBILITY_URL?.trim()

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    ...(privateReleaseKey ? { key: privateReleaseKey } : {}),
    default_locale: 'en',
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    version: '0.1.0',
    permissions: ['alarms', 'downloads', 'nativeMessaging', 'notifications', 'sidePanel', 'storage', 'tabs'],
    host_permissions: [
      'https://chatgpt.com/*',
      'https://www.chatgpt.com/*',
      'https://raw.githubusercontent.com/BeforeWave/agent-helm/main/compatibility/*',
      ...(uatCompatibilityUrl ? ['http://127.0.0.1/*'] : []),
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
})
