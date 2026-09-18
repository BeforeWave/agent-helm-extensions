#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const canonicalExtensionId = manifest.chromeExtension?.id
const scriptsRoot = join(root, 'scripts')
const buildSource = readFileSync(join(root, 'build.mjs'), 'utf8')
const preinstallSource = readFileSync(join(scriptsRoot, 'preinstall'), 'utf8')
const postinstallSource = readFileSync(join(scriptsRoot, 'postinstall'), 'utf8')
const backendSource = readFileSync(join(scriptsRoot, 'agent-helm-install.sh'), 'utf8')

function check(condition, message) {
  if (!condition) throw new Error(message)
}

check(manifest.name === 'agent-helm-installer', 'installer package name must be agent-helm-installer')
check(/^[a-p]{32}$/.test(canonicalExtensionId ?? ''), 'installer package must own the canonical Chrome Extension ID')
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

console.log(`Agent Helm Installer contract verification OK (Installer ${manifest.version} -> Agent Helm ${manifest.agentHelm.version}); PKG is intentionally built only during GitHub publication`)
