#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const [manifestUrl, version, packageName, outputDir] = process.argv.slice(2)
if (!manifestUrl || !version || !packageName || !outputDir) throw new Error('usage: resolve-release-package.mjs MANIFEST_URL VERSION PACKAGE OUTPUT_DIR')

async function download(url, maxBytes) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`download failed (${response.status}) for ${url}`)
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error(`download is too large: ${url}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > maxBytes) throw new Error(`download is too large: ${url}`)
  return bytes
}

const manifestBytes = await download(manifestUrl, 2 * 1024 * 1024)
const manifest = JSON.parse(manifestBytes.toString('utf8'))
if (manifest?.schemaVersion !== 1 || manifest?.releaseVersion !== version || !Array.isArray(manifest?.artifacts)) {
  throw new Error(`release-manifest.json does not describe Agent Helm ${version}`)
}
const matches = manifest.artifacts.filter((item) => item?.id === 'agent-helm-package')
if (matches.length !== 1) throw new Error('release-manifest.json must contain exactly one agent-helm-package artifact')
const artifact = matches[0]
if (artifact.kind !== 'npm-tarball' || artifact.name !== packageName || artifact.version !== version) {
  throw new Error('Agent Helm package artifact contract does not match the requested release')
}
for (const key of ['assetName', 'downloadUrl', 'sha256']) {
  if (typeof artifact[key] !== 'string' || !artifact[key].trim()) throw new Error(`Agent Helm package artifact is missing ${key}`)
}
if (artifact.assetName.includes('/') || artifact.assetName.includes('\\')) throw new Error('Agent Helm package assetName must be a file name')
if (!/^[a-f0-9]{64}$/i.test(artifact.sha256)) throw new Error('Agent Helm package SHA256 is invalid')
const source = new URL(manifestUrl)
const target = new URL(artifact.downloadUrl)
if (source.origin !== target.origin) throw new Error('Agent Helm package download origin does not match the release manifest origin')
if (source.origin === 'https://github.com') {
  const prefix = `/BeforeWave/agent-helm/releases/download/v${version}/`
  if (!target.pathname.startsWith(prefix) || !target.pathname.endsWith(`/${artifact.assetName}`)) {
    throw new Error('Agent Helm package URL is outside the matching GitHub release')
  }
}

const archive = await download(artifact.downloadUrl, 256 * 1024 * 1024)
const actual = createHash('sha256').update(archive).digest('hex')
if (actual !== artifact.sha256.toLowerCase()) throw new Error(`Agent Helm package SHA256 mismatch: expected ${artifact.sha256}, got ${actual}`)
await mkdir(outputDir, { recursive: true, mode: 0o700 })
const output = join(outputDir, artifact.assetName)
await writeFile(output, archive, { mode: 0o600 })
process.stdout.write(`${output}\n`)
