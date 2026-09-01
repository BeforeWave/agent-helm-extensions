import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const installerLib = join(root, 'scripts', 'installer-lib.sh')
const resolver = join(root, 'scripts', 'resolve-release-package.mjs')
const integrityVerifier = join(root, 'scripts', 'verify-installer-artifact.sh')

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
  assert.match(result.stderr, /Extension ID is missing/)
})

test('release resolver verifies the exact Agent Helm package SHA256', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'agent-helm-installer-resolver-'))
  try {
    const packageBytes = Buffer.from('agent-helm-installer-package-fixture')
    const sha256 = createHash('sha256').update(packageBytes).digest('hex')
    const artifact = 'beforewave-agent-helm-fixture.tgz'
    const packageUrl = 'data:application/octet-stream;base64,' + packageBytes.toString('base64')
    const releaseManifest = {
      schemaVersion: 1,
      releaseVersion: manifest.version,
      artifacts: [{
        id: 'agent-helm-package',
        kind: 'npm-tarball',
        name: '@beforewave/agent-helm',
        version: manifest.version,
        assetName: artifact,
        downloadUrl: packageUrl,
        sha256,
      }],
    }
    const manifestUrl = 'data:application/json;base64,' + Buffer.from(JSON.stringify(releaseManifest)).toString('base64')
    const output = execFileSync(process.execPath, [resolver, manifestUrl, manifest.version, '@beforewave/agent-helm', fixture], { encoding: 'utf8' }).trim()
    assert.deepEqual(readFileSync(output), packageBytes)

    releaseManifest.artifacts[0].sha256 = '0'.repeat(64)
    const invalidUrl = 'data:application/json;base64,' + Buffer.from(JSON.stringify(releaseManifest)).toString('base64')
    const rejected = spawnSync(process.execPath, [resolver, invalidUrl, manifest.version, '@beforewave/agent-helm', fixture], { encoding: 'utf8' })
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /SHA256 mismatch/)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})


test('installer artifact verification fails closed on SHA-256 mismatch', { skip: process.platform !== 'darwin' }, () => {
  const fixture = mkdtempSync(join(tmpdir(), 'agent-helm-installer-integrity-'))
  try {
    const packageFile = join(fixture, `Agent-Helm-Installer-${manifest.version}--chrome-${extensionId}.pkg`)
    const manifestFile = join(fixture, 'release-manifest.json')
    const packageBytes = Buffer.from('agent-helm-installer-pkg-fixture')
    writeFileSync(packageFile, packageBytes)
    const sha256 = createHash('sha256').update(packageBytes).digest('hex')
    const releaseManifest = {
      schemaVersion: 1,
      releaseVersion: manifest.version,
      artifacts: [{
        id: 'agent-helm-installer', kind: 'native-installer', platform: 'macos', version: manifest.version,
        assetName: `Agent-Helm-Installer-${manifest.version}.pkg`,
        downloadUrl: `http://127.0.0.1:48766/files/Agent-Helm-Installer-${manifest.version}.pkg`,
        sha256,
      }],
    }
    writeFileSync(manifestFile, JSON.stringify(releaseManifest))
    const command = '. "$1"; agent_helm_verify_installer_manifest_file "$2" "$3" "$4" "$5"'
    const ok = spawnSync('/bin/sh', ['-c', command, 'integrity-test', integrityVerifier, manifestFile, 'http://127.0.0.1:48766/agent-helm/release-manifest.json', manifest.version, packageFile], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stderr || ok.stdout)

    releaseManifest.artifacts[0].sha256 = '0'.repeat(64)
    writeFileSync(manifestFile, JSON.stringify(releaseManifest))
    const rejected = spawnSync('/bin/sh', ['-c', command, 'integrity-test', integrityVerifier, manifestFile, 'http://127.0.0.1:48766/agent-helm/release-manifest.json', manifest.version, packageFile], { encoding: 'utf8' })
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /SHA-256 mismatch/)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
