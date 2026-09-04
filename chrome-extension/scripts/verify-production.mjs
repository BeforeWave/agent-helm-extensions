#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, '.output', 'chrome-mv3')
const manifestFile = join(output, 'manifest.json')

function check(condition, message) {
  if (!condition) throw new Error(message)
}

check(existsSync(manifestFile), 'production Chrome build must produce .output/chrome-mv3/manifest.json')
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
const permissions = new Set(manifest.permissions ?? [])
const optionalPermissions = new Set(manifest.optional_permissions ?? [])
const hostPermissions = new Set(manifest.host_permissions ?? [])
const expectedPermissions = new Set(['alarms', 'nativeMessaging', 'notifications', 'sidePanel', 'storage'])
const expectedHostPermissions = new Set(['https://chatgpt.com/*'])

check(permissions.size === expectedPermissions.size && [...expectedPermissions].every((permission) => permissions.has(permission)), `production required permissions mismatch: ${[...permissions].join(', ')}`)
check(optionalPermissions.size === 1 && optionalPermissions.has('downloads'), 'downloads must be the only optional production permission')
check(hostPermissions.size === expectedHostPermissions.size && [...expectedHostPermissions].every((permission) => hostPermissions.has(permission)), `production host permissions mismatch: ${[...hostPermissions].join(', ')}`)
for (const forbidden of ['tabs', 'cookies', 'history', 'webRequest', 'scripting', '<all_urls>']) {
  check(!permissions.has(forbidden), `production manifest must not include ${forbidden}`)
}
for (const forbiddenHost of ['https://www.chatgpt.com/*', 'https://raw.githubusercontent.com/*', 'http://127.0.0.1/*', 'http://localhost/*', '<all_urls>']) {
  check(!hostPermissions.has(forbiddenHost), `production manifest must not include ${forbiddenHost}`)
}
check(!manifest.content_scripts?.length, 'production Extension must not inject content scripts into ChatGPT')
check(!manifest.externally_connectable, 'production Extension must not expose runtime messaging to webpages or other extensions')

for (const required of ['manifest.json', 'background.js', 'popup.html', 'sidepanel.html']) {
  check(existsSync(join(output, required)), `production Chrome build is incomplete: missing ${required}`)
}

const configSource = readFileSync(join(root, 'wxt.config.ts'), 'utf8')
const pageContextSource = readFileSync(join(root, 'src', 'services', 'pageContext.ts'), 'utf8')
check(!configSource.includes("'tabs'"), 'public Chrome source must not request tabs permission')
check(!configSource.includes('https://www.chatgpt.com/*'), 'public Chrome source must not request redirect-only www.chatgpt.com access')
check(!configSource.includes('raw.githubusercontent.com/BeforeWave/agent-helm/main/compatibility'), 'public Chrome source must not request runtime compatibility metadata')
check(pageContextSource.includes("const CHATGPT_HOST = 'chatgpt.com'"), 'page-context recognition must stay scoped to chatgpt.com')
check(pageContextSource.includes("kind: 'other', url: null, conversationUrl: null"), 'ordinary pages must fail closed without URL exposure')

const files = []
const stack = [output]
while (stack.length) {
  const current = stack.pop()
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name)
    if (entry.isDirectory()) stack.push(path)
    else files.push(relative(output, path).split('\\').join('/'))
  }
}
for (const file of files) {
  check(!file.startsWith('preview/'), `production Chrome artifact leaks preview code: ${file}`)
  check(!file.startsWith('tests/'), `production Chrome artifact leaks tests: ${file}`)
  check(!file.endsWith('.map'), `production Chrome artifact leaks sourcemap: ${file}`)
  check(!file.endsWith('.ts') && !file.endsWith('.tsx'), `production Chrome artifact leaks source file: ${file}`)
  check(file !== 'vite.preview.config.ts', 'production Chrome artifact leaks preview config')
}

console.log('Chrome Extension package production verification OK')
console.log('required permissions: alarms, nativeMessaging, notifications, sidePanel, storage')
console.log('optional permission: downloads')
console.log('host permissions: https://chatgpt.com/*')
