import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildInstallerRuntimeBundle } from '../runtime-bundle.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const compatibility = JSON.parse(readFileSync(resolve(root, '..', '..', '..', 'compatibility', 'chrome.json'), 'utf8'))
const canonicalExtensionId = compatibility.chromeExtension.id
const coreVersion = manifest.agentHelm.version
const installerLib = join(root, 'scripts', 'installer-lib.sh')

const extensionId = 'bnmokhimnnlfohfjbgigcmpckkncffdo'

test('Agent Helm Installer filename carries the Chrome Extension ID', () => {
  const filename = `Agent-Helm-Installer-${manifest.version}--chrome-${extensionId}.pkg`
  const parsed = execFileSync('/bin/sh', ['-c', `. "$1"; agent_helm_extension_id_from_package "$2"`, 'installer-test', installerLib, filename], { encoding: 'utf8' }).trim()
  assert.equal(parsed, extensionId)
})

test('legacy Agent-Helm PKG filename is rejected', () => {
  const filename = `Agent-Helm-${manifest.version}--chrome-${extensionId}.pkg`
  const result = spawnSync('/bin/sh', ['-c', `. "$1"; agent_helm_extension_id_from_package "$2"`, 'installer-test', installerLib, filename], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Installer filename is invalid/)
})

test('generic release PKG filename uses the canonical Extension ID', () => {
  const filename = `Agent-Helm-Installer-${manifest.version}.pkg`
  const parsed = execFileSync('/bin/sh', ['-c', `. "$1"; agent_helm_extension_id_from_package "$2" "$3"`, 'installer-test', installerLib, filename, canonicalExtensionId], { encoding: 'utf8' }).trim()
  assert.equal(parsed, canonicalExtensionId)
})

test('installer runtime bundle contains the full resolved dependency closure', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'agent-helm-runtime-bundle-'))
  try {
    const sourceRoot = join(fixture, 'repo')
    const nodeModules = join(sourceRoot, 'node_modules')
    const coreSource = join(sourceRoot, 'packages', 'agent-helm')
    const coreStage = join(fixture, 'core-stage')
    const depA = join(nodeModules, 'dep-a')
    const depB = join(nodeModules, 'dep-b')
    const ui = join(coreStage, 'node_modules', '@beforewave', 'agent-helm-ui-contract')
    for (const directory of [coreSource, coreStage, depA, depB, ui]) mkdirSync(directory, { recursive: true })
    writeFileSync(join(coreSource, 'package.json'), JSON.stringify({ name: '@beforewave/agent-helm', version: coreVersion, dependencies: { 'dep-a': '1.0.0', '@beforewave/agent-helm-ui-contract': manifest.version } }))
    writeFileSync(join(coreStage, 'package.json'), JSON.stringify({ name: '@beforewave/agent-helm', version: coreVersion, dependencies: { 'dep-a': '1.0.0', '@beforewave/agent-helm-ui-contract': manifest.version } }))
    mkdirSync(join(coreStage, 'lib'), { recursive: true })
    writeFileSync(join(coreStage, 'lib', 'cli.js'), 'console.log("fixture")\n')
    writeFileSync(join(ui, 'package.json'), JSON.stringify({ name: '@beforewave/agent-helm-ui-contract', version: coreVersion }))
    writeFileSync(join(depA, 'package.json'), JSON.stringify({ name: 'dep-a', version: '1.0.0', dependencies: { 'dep-b': '1.0.0' } }))
    writeFileSync(join(depB, 'package.json'), JSON.stringify({ name: 'dep-b', version: '1.0.0' }))

    const output = join(fixture, 'runtime.tgz')
    const result = buildInstallerRuntimeBundle({ coreStage, coreSourceDir: coreSource, nodeModulesRoot: nodeModules, output })
    assert.equal(result.packageCount, 3)
    const listing = execFileSync('/usr/bin/tar', ['-tzf', output], { encoding: 'utf8' })
    assert.match(listing, /node_modules\/@beforewave\/agent-helm\/lib\/cli\.js/)
    assert.match(listing, /node_modules\/dep-a\/package\.json/)
    assert.match(listing, /node_modules\/dep-b\/package\.json/)
    assert.match(listing, /node_modules\/@beforewave\/agent-helm\/node_modules\/@beforewave\/agent-helm-ui-contract\/package\.json/)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
