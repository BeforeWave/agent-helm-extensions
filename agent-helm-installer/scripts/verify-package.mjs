#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const compatibility = JSON.parse(readFileSync(resolve(root, '..', '..', '..', 'compatibility', 'chrome.json'), 'utf8'))
const canonicalExtensionId = compatibility.chromeExtension.id
const scriptsRoot = join(root, 'scripts')
const buildSource = readFileSync(join(root, 'build.mjs'), 'utf8')
const preinstallSource = readFileSync(join(scriptsRoot, 'preinstall'), 'utf8')
const postinstallSource = readFileSync(join(scriptsRoot, 'postinstall'), 'utf8')
const backendSource = readFileSync(join(scriptsRoot, 'agent-helm-install.sh'), 'utf8')

function check(condition, message) {
  if (!condition) throw new Error(message)
}

check(manifest.name === 'agent-helm-installer', 'installer package name must be agent-helm-installer')
check(buildSource.includes('/usr/bin/pkgbuild') && buildSource.includes('--nopayload'), 'installer builder must create a script-resource PKG without a system payload')
check(buildSource.includes("'--runtime-bundle'") && buildSource.includes("'--agent-helm-version'") && buildSource.includes("'--chrome-extension-id'") && buildSource.includes('agent-helm-runtime.tgz'), 'installer builder must independently pin the Agent Helm version and embed its self-contained runtime')
check(!buildSource.includes('--release-manifest-url'), 'PKG builder must not depend on a release manifest URL')
check(!buildSource.includes('resolve-release-package.mjs') && !buildSource.includes('verify-installer-artifact.sh'), 'PKG must not package network release resolvers or remote artifact verification')
check(buildSource.includes('/usr/bin/productsign') && buildSource.includes('AGENT_HELM_PKG_SIGN_IDENTITY'), 'installer builder must reserve final-artifact Developer ID signing')
check(!buildSource.includes('productbuild'), 'installer signing must not wrap the component package and break package-path Extension ID handoff')
check(preinstallSource.includes('agent-helm-runtime.tgz') && preinstallSource.includes('__AGENT_HELM_RUNTIME_SHA256__'), 'PKG preinstall must verify the embedded runtime before mutation')
check(!preinstallSource.includes('curl') && !preinstallSource.includes('release-manifest'), 'PKG preinstall must not require network access')
check(postinstallSource.includes('agent-helm-install.sh'), 'PKG postinstall must delegate to the package-owned install backend')
check(postinstallSource.includes('AGENT_HELM_CHROME_EXTENSION_ID'), 'PKG postinstall must pass the Chrome Extension ID to the install backend')
check(postinstallSource.includes('AGENT_HELM_RUNTIME_BUNDLE') && postinstallSource.includes('AGENT_HELM_RUNTIME_BUNDLE_SHA256'), 'PKG postinstall must bind installation to the embedded runtime')
check(!postinstallSource.includes('AGENT_HELM_RELEASE_MANIFEST_URL') && !postinstallSource.includes('AGENT_HELM_RELEASE_RESOLVER'), 'PKG postinstall must not resolve Core from GitHub')
check(postinstallSource.includes('agent_helm_preflight') && postinstallSource.includes('agent_helm_postflight'), 'PKG postinstall must run preflight and postflight around installation')
check(backendSource.includes('RUNTIME_BUNDLE=${AGENT_HELM_RUNTIME_BUNDLE:-}') && backendSource.includes('Installing bundled Agent Helm ${VERSION} runtime'), 'installer backend must support offline bundled runtime activation')
check(!backendSource.includes('RELEASE_MANIFEST_URL') && !backendSource.includes('RELEASE_RESOLVER'), 'installer backend must not contain a remote/local release-manifest fallback')

if (process.platform !== 'darwin') {
  console.log('Agent Helm Installer package verification OK; macOS PKG expansion skipped outside macOS')
  process.exit(0)
}

const fixture = mkdtempSync(join(root, '.agent-helm-installer-package-'))
try {
  const runtimeRoot = join(fixture, 'runtime')
  const coreRoot = join(runtimeRoot, 'node_modules', '@beforewave', 'agent-helm')
  mkdirSync(join(coreRoot, 'lib'), { recursive: true })
  writeFileSync(join(coreRoot, 'package.json'), JSON.stringify({ name: '@beforewave/agent-helm', version: manifest.agentHelm.version }))
  writeFileSync(join(coreRoot, 'lib', 'cli.js'), 'console.log("fixture")\n')
  const runtimeBundle = join(fixture, 'runtime.tgz')
  execFileSync('/usr/bin/tar', ['-czf', runtimeBundle, '-C', runtimeRoot, '.'])
  const runtimeSha = createHash('sha256').update(readFileSync(runtimeBundle)).digest('hex')

  const pkgFile = join(fixture, `Agent-Helm-Installer-${manifest.version}.pkg`)
  execFileSync(process.execPath, [join(root, 'build.mjs'), '--version', manifest.version, '--agent-helm-version', manifest.agentHelm.version, '--chrome-extension-id', canonicalExtensionId, '--runtime-bundle', runtimeBundle, '--output', pkgFile], {
    cwd: root,
    stdio: 'inherit',
  })
  check(existsSync(pkgFile), 'installer builder did not produce the requested PKG')

  const expanded = join(fixture, 'expanded')
  execFileSync('/usr/sbin/pkgutil', ['--expand', pkgFile, expanded], { cwd: root, stdio: 'inherit' })
  check(readFileSync(join(expanded, 'Scripts', 'agent-helm-install.sh'), 'utf8') === backendSource, 'expanded PKG must retain the package-owned install backend byte-for-byte')
  check(readFileSync(join(expanded, 'Scripts', 'agent-helm-runtime.tgz')).equals(readFileSync(runtimeBundle)), 'expanded PKG must retain the exact self-contained runtime bundle')

  const packagedPreinstall = readFileSync(join(expanded, 'Scripts', 'preinstall'), 'utf8')
  const packagedPostinstall = readFileSync(join(expanded, 'Scripts', 'postinstall'), 'utf8')
  check(packagedPreinstall.includes(runtimeSha) && packagedPreinstall.includes('bundled runtime integrity verified'), 'expanded PKG must pin and verify the embedded runtime SHA-256')
  check(packagedPostinstall.includes(`AGENT_HELM_VERSION="${manifest.agentHelm.version}"`) && packagedPostinstall.includes(`AGENT_HELM_RUNTIME_BUNDLE_SHA256="${runtimeSha}"`) && packagedPostinstall.includes('agent_helm_postflight'), 'expanded PKG must pin its Core version/runtime hash and retain postflight verification')

  const packageInfo = readFileSync(join(expanded, 'PackageInfo'), 'utf8')
  check(packageInfo.includes('identifier="com.beforewave.agent-helm.installer"'), 'PKG identifier mismatch')
  check(packageInfo.includes(`version="${manifest.version}"`), 'PKG version mismatch')

  console.log(`Agent Helm Installer package verification OK (Installer ${manifest.version} -> Agent Helm ${manifest.agentHelm.version})`)
} finally {
  rmSync(fixture, { recursive: true, force: true })
}
