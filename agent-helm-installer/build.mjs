#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
if (process.platform !== 'darwin') throw new Error('Agent Helm Installer PKG artifacts must be built on macOS.')

let version = process.env.AGENT_HELM_INSTALLER_VERSION?.trim() || manifest.version
let agentHelmVersion = process.env.AGENT_HELM_VERSION?.trim() || manifest.agentHelm?.version || ''
let output = ''
let signIdentity = process.env.AGENT_HELM_PKG_SIGN_IDENTITY?.trim() || ''
let runtimeBundle = process.env.AGENT_HELM_RUNTIME_BUNDLE?.trim() || ''
let chromeExtensionId = process.env.AGENT_HELM_CHROME_EXTENSION_ID?.trim() || ''
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index]
  if (arg === '--version') version = process.argv[++index] ?? ''
  else if (arg === '--agent-helm-version') agentHelmVersion = process.argv[++index] ?? ''
  else if (arg === '--output') output = resolve(process.argv[++index] ?? '')
  else if (arg === '--sign-identity') signIdentity = process.argv[++index] ?? ''
  else if (arg === '--runtime-bundle') runtimeBundle = resolve(process.argv[++index] ?? '')
  else if (arg === '--chrome-extension-id') chromeExtensionId = process.argv[++index] ?? ''
  else throw new Error(`unknown Agent Helm Installer build option: ${arg}`)
}
if (!semanticVersionPattern.test(version)) throw new Error('--version requires an Installer semantic version')
if (!semanticVersionPattern.test(agentHelmVersion)) throw new Error('--agent-helm-version requires an Agent Helm semantic version')
if (!runtimeBundle) throw new Error('--runtime-bundle is required; the PKG must embed a self-contained Agent Helm runtime')
if (!/^[a-p]{32}$/.test(chromeExtensionId)) throw new Error('--chrome-extension-id requires the canonical 32-character Chrome Extension ID')

const bundledManifest = JSON.parse(execFileSync('/usr/bin/tar', [
  '-xOf', runtimeBundle, './node_modules/@beforewave/agent-helm/package.json',
], { encoding: 'utf8' }))
if (bundledManifest.name !== '@beforewave/agent-helm') throw new Error('runtime bundle does not contain @beforewave/agent-helm')
if (bundledManifest.version !== agentHelmVersion) throw new Error(`runtime bundle Agent Helm version ${bundledManifest.version} does not match pinned Agent Helm ${agentHelmVersion}`)

const runtimeSha256 = createHash('sha256').update(readFileSync(runtimeBundle)).digest('hex')
const assetName = `Agent-Helm-Installer-${version}.pkg`
if (!output) output = join(root, 'dist', assetName)

mkdirSync(dirname(output), { recursive: true })
const staging = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'agent-helm-installer-build-'))

try {
  const scriptsDir = join(staging, 'scripts')
  mkdirSync(scriptsDir, { recursive: true })
  const packagedScripts = ['installer-lib.sh', 'preinstall', 'postinstall', 'agent-helm-install.sh']
  for (const name of packagedScripts) copyFileSync(join(root, 'scripts', name), join(scriptsDir, name))
  copyFileSync(runtimeBundle, join(scriptsDir, 'agent-helm-runtime.tgz'))

  for (const scriptName of ['preinstall', 'postinstall']) {
    const scriptFile = join(scriptsDir, scriptName)
    const script = readFileSync(scriptFile, 'utf8')
      .split('__AGENT_HELM_VERSION__').join(agentHelmVersion)
      .split('__AGENT_HELM_RUNTIME_SHA256__').join(runtimeSha256)
      .split('__AGENT_HELM_CHROME_EXTENSION_ID__').join(chromeExtensionId)
    writeFileSync(scriptFile, script)
  }
  for (const name of packagedScripts) chmodSync(join(scriptsDir, name), 0o755)
  chmodSync(join(scriptsDir, 'agent-helm-runtime.tgz'), 0o644)

  const unsignedOutput = signIdentity ? join(staging, assetName) : output
  execFileSync('/usr/bin/pkgbuild', [
    '--identifier', 'com.beforewave.agent-helm.installer',
    '--version', version,
    '--nopayload',
    '--scripts', scriptsDir,
    unsignedOutput,
  ], { cwd: root, stdio: 'inherit' })

  if (signIdentity) {
    execFileSync('/usr/bin/productsign', ['--sign', signIdentity, unsignedOutput, output], {
      cwd: root,
      stdio: 'inherit',
    })
  }

  console.log(`${signIdentity ? 'Signed' : 'Unsigned'} Agent Helm Installer: ${output}`)
  console.log(`Release asset: ${assetName}`)
  console.log(`Pinned Agent Helm: ${agentHelmVersion}`)
  console.log(`Default Chrome Extension ID: ${chromeExtensionId}`)
  console.log(`Embedded Agent Helm runtime: ${basename(runtimeBundle)} (${runtimeSha256})`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}
