import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildInstallerRuntimeBundle } from '../runtime-bundle.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const canonicalExtensionId = manifest.chromeExtension?.id
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
    for (const directory of [coreSource, coreStage, depA, depB]) mkdirSync(directory, { recursive: true })
    writeFileSync(join(coreSource, 'package.json'), JSON.stringify({ name: '@beforewave/agent-helm', version: coreVersion, dependencies: { 'dep-a': '1.0.0' } }))
    writeFileSync(join(coreStage, 'package.json'), JSON.stringify({ name: '@beforewave/agent-helm', version: coreVersion, dependencies: { 'dep-a': '1.0.0' } }))
    mkdirSync(join(coreStage, 'lib'), { recursive: true })
    writeFileSync(join(coreStage, 'lib', 'cli.js'), 'console.log("fixture")\n')
    writeFileSync(join(depA, 'package.json'), JSON.stringify({ name: 'dep-a', version: '1.0.0', dependencies: { 'dep-b': '1.0.0' } }))
    writeFileSync(join(depB, 'package.json'), JSON.stringify({ name: 'dep-b', version: '1.0.0' }))

    const output = join(fixture, 'runtime.tgz')
    const result = buildInstallerRuntimeBundle({ coreStage, coreSourceDir: coreSource, nodeModulesRoot: nodeModules, output })
    assert.equal(result.packageCount, 3)
    const listing = execFileSync('/usr/bin/tar', ['-tzf', output], { encoding: 'utf8' })
    assert.match(listing, /node_modules\/@beforewave\/agent-helm\/lib\/cli\.js/)
    assert.match(listing, /node_modules\/dep-a\/package\.json/)
    assert.match(listing, /node_modules\/dep-b\/package\.json/)
    assert.doesNotMatch(listing, /agent-helm-ui-contract/)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})

test('installer runtime bundle preserves package-local npm dependencies and hoisted transitive peers', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'agent-helm-runtime-nested-'))
  try {
    const sourceRoot = join(fixture, 'repo')
    const nodeModules = join(sourceRoot, 'node_modules')
    const coreSource = join(sourceRoot, 'packages', 'agent-helm')
    const coreStage = join(fixture, 'core-stage')
    const localDep = join(coreSource, 'node_modules', 'local-dep')
    const sharedDep = join(nodeModules, 'shared-dep')
    for (const directory of [coreSource, coreStage, localDep, sharedDep, join(coreStage, 'lib')]) mkdirSync(directory, { recursive: true })
    writeFileSync(join(coreStage, 'package.json'), JSON.stringify({ name: '@beforewave/agent-helm', version: coreVersion, dependencies: { 'local-dep': '1.0.0' } }))
    writeFileSync(join(coreStage, 'lib', 'cli.js'), "module.exports = require('local-dep')\n")
    writeFileSync(join(localDep, 'package.json'), JSON.stringify({ name: 'local-dep', version: '1.0.0', dependencies: { 'shared-dep': '1.0.0' } }))
    writeFileSync(join(localDep, 'index.js'), "module.exports = require('shared-dep') + '-local'\n")
    writeFileSync(join(sharedDep, 'package.json'), JSON.stringify({ name: 'shared-dep', version: '1.0.0' }))
    writeFileSync(join(sharedDep, 'index.js'), "module.exports = 'shared'\n")
    const output = join(fixture, 'runtime.tgz')
    assert.equal(buildInstallerRuntimeBundle({ coreStage, coreSourceDir: coreSource, nodeModulesRoot: nodeModules, output }).packageCount, 3)
    const extracted = join(fixture, 'extracted')
    mkdirSync(extracted)
    execFileSync('/usr/bin/tar', ['-xzf', output, '-C', extracted])
    const cli = join(extracted, 'node_modules', '@beforewave', 'agent-helm', 'lib', 'cli.js')
    assert.equal(execFileSync(process.execPath, ['-e', 'console.log(require(process.argv[1]))', cli], { encoding: 'utf8' }).trim(), 'shared-local')
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})

test('installer runtime bundle rejects dependencies escaping both managed node_modules roots', { skip: process.platform === 'win32' }, () => {
  const fixture = mkdtempSync(join(tmpdir(), 'agent-helm-runtime-escape-'))
  try {
    const sourceRoot = join(fixture, 'repo')
    const nodeModules = join(sourceRoot, 'node_modules')
    const coreSource = join(sourceRoot, 'packages', 'agent-helm')
    const coreStage = join(fixture, 'core-stage')
    const external = join(fixture, 'outside-package')
    for (const directory of [nodeModules, coreSource, coreStage, external, join(coreSource, 'node_modules')]) mkdirSync(directory, { recursive: true })
    writeFileSync(join(coreStage, 'package.json'), JSON.stringify({ name: '@beforewave/agent-helm', version: coreVersion, dependencies: { escaped: '1.0.0' } }))
    writeFileSync(join(external, 'package.json'), JSON.stringify({ name: 'escaped', version: '1.0.0' }))
    symlinkSync(external, join(coreSource, 'node_modules', 'escaped'))
    assert.throws(() => buildInstallerRuntimeBundle({ coreStage, coreSourceDir: coreSource, nodeModulesRoot: nodeModules, output: join(fixture, 'runtime.tgz') }), /outside managed node_modules/)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
