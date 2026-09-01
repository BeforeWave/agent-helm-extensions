#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
if (process.platform !== 'darwin') throw new Error('Agent Helm Installer PKG artifacts must be built on macOS.')

let version = process.env.AGENT_HELM_VERSION?.trim() || manifest.version
let output = ''
let signIdentity = process.env.AGENT_HELM_PKG_SIGN_IDENTITY?.trim() || ''
let releaseManifestUrl = ''
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index]
  if (arg === '--version') version = process.argv[++index] ?? ''
  else if (arg === '--output') output = resolve(process.argv[++index] ?? '')
  else if (arg === '--sign-identity') signIdentity = process.argv[++index] ?? ''
  else if (arg === '--release-manifest-url') releaseManifestUrl = process.argv[++index] ?? ''
  else throw new Error(`unknown Agent Helm Installer build option: ${arg}`)
}
if (!semanticVersionPattern.test(version)) throw new Error('--version requires an Agent Helm semantic version')

const assetName = `Agent-Helm-Installer-${version}.pkg`
const productionManifestUrl = `https://github.com/BeforeWave/agent-helm/releases/download/v${version}/release-manifest.json`
if (!releaseManifestUrl) releaseManifestUrl = productionManifestUrl
if (!output) output = join(root, 'dist', assetName)
if (releaseManifestUrl !== productionManifestUrl) {
  let overrideUrl
  try { overrideUrl = new URL(releaseManifestUrl) } catch { throw new Error('--release-manifest-url must be the production URL or an http://127.0.0.1 UAT URL') }
  if (overrideUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(overrideUrl.hostname)) {
    throw new Error('--release-manifest-url must be the production URL or an http://127.0.0.1 UAT URL')
  }
}

mkdirSync(dirname(output), { recursive: true })
const staging = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'agent-helm-installer-build-'))

try {
  const scriptsDir = join(staging, 'scripts')
  mkdirSync(scriptsDir, { recursive: true })
  for (const name of ['installer-lib.sh', 'preinstall', 'postinstall', 'verify-installer-artifact.sh', 'resolve-release-package.mjs', 'agent-helm-install.sh']) {
    copyFileSync(join(root, 'scripts', name), join(scriptsDir, name))
  }

  for (const scriptName of ['preinstall', 'postinstall']) {
    const scriptFile = join(scriptsDir, scriptName)
    const script = readFileSync(scriptFile, 'utf8')
      .split('__AGENT_HELM_VERSION__').join(version)
      .split('__AGENT_HELM_RELEASE_MANIFEST_URL__').join(releaseManifestUrl)
    writeFileSync(scriptFile, script)
  }
  for (const name of ['installer-lib.sh', 'preinstall', 'postinstall', 'verify-installer-artifact.sh', 'resolve-release-package.mjs', 'agent-helm-install.sh']) {
    chmodSync(join(scriptsDir, name), 0o755)
  }

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
} finally {
  rmSync(staging, { recursive: true, force: true })
}
