import { readFileSync } from 'node:fs'
import { defineConfig } from 'wxt'

const privateReleaseKey = process.env.AGENT_HELM_PRIVATE_CHROME_PUBLIC_KEY?.trim()
const packageManifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: unknown }
const packageVersion = typeof packageManifest.version === 'string' ? packageManifest.version : ''
if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) throw new Error(`Chrome Extension package version must be x.y.z; got ${packageVersion || '(missing)'}`)
const releaseVersion = process.env.AGENT_HELM_RELEASE_VERSION?.trim() || packageVersion
const releaseMatch = /^(\d+\.\d+\.\d+)(-dev)?$/.exec(releaseVersion)
if (!releaseMatch || releaseMatch[1] !== packageVersion) throw new Error(`Chrome Extension release version ${releaseVersion || '(missing)'} must target package version ${packageVersion}`)
const developmentRelease = Boolean(releaseMatch[2])

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  zip: {
    artifactTemplate: '{{name}}-{{packageVersion}}-{{browser}}.zip',
  },
  manifest: {
    ...(privateReleaseKey ? { key: privateReleaseKey } : {}),
    default_locale: 'en',
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    version: packageVersion,
    ...(developmentRelease ? { version_name: releaseVersion } : {}),
    permissions: ['alarms', 'nativeMessaging', 'notifications', 'sidePanel', 'storage'],
    optional_permissions: ['downloads'],
    host_permissions: [
      'https://chatgpt.com/*',
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
})
