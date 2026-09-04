import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'

function readManifest(directory) {
  return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
}

function dependencyDirectory(startDirectory, packageName) {
  let cursor = resolve(startDirectory)
  const segments = packageName.split('/')
  for (;;) {
    const candidate = join(cursor, 'node_modules', ...segments)
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate)
    const parent = dirname(cursor)
    if (parent === cursor) return null
    cursor = parent
  }
}

function runtimeDependencies(manifest) {
  const required = new Set(Object.keys(manifest.dependencies ?? {}))
  const optional = new Set(Object.keys(manifest.optionalDependencies ?? {}))
  for (const name of Object.keys(manifest.peerDependencies ?? {})) {
    if (manifest.peerDependenciesMeta?.[name]?.optional === true) optional.add(name)
    else required.add(name)
  }
  return [
    ...[...required].map((name) => ({ name, optional: false })),
    ...[...optional].filter((name) => !required.has(name)).map((name) => ({ name, optional: true })),
  ]
}

export function buildInstallerRuntimeBundle({
  coreStage,
  coreSourceDir,
  nodeModulesRoot,
  output,
  packageName = '@beforewave/agent-helm',
  bundledWorkspacePackages = ['@beforewave/agent-helm-ui-contract'],
}) {
  const resolvedNodeModulesRoot = realpathSync(nodeModulesRoot)
  const staging = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'agent-helm-installer-runtime-'))
  const runtimeNodeModules = join(staging, 'node_modules')
  const bundledWorkspaceSet = new Set(bundledWorkspacePackages)
  const copied = new Set()

  try {
    const coreDestination = join(runtimeNodeModules, ...packageName.split('/'))
    mkdirSync(dirname(coreDestination), { recursive: true })
    cpSync(coreStage, coreDestination, { recursive: true, dereference: true })

    const queue = runtimeDependencies(readManifest(coreStage))
      .filter(({ name }) => !bundledWorkspaceSet.has(name))
      .map((entry) => ({ ...entry, owner: coreSourceDir }))

    while (queue.length) {
      const { name, optional, owner } = queue.shift()
      if (bundledWorkspaceSet.has(name)) continue
      const source = dependencyDirectory(owner, name)
      if (!source) {
        if (optional) continue
        throw new Error(`installer runtime dependency is unavailable: ${name} required by ${owner}`)
      }
      if (copied.has(source)) continue

      const relativeSource = relative(resolvedNodeModulesRoot, source)
      if (!relativeSource || relativeSource === '..' || relativeSource.startsWith(`..${sep}`)) {
        throw new Error(`installer runtime dependency resolved outside root node_modules: ${name} -> ${source}`)
      }
      const destination = join(runtimeNodeModules, relativeSource)
      mkdirSync(dirname(destination), { recursive: true })
      cpSync(source, destination, { recursive: true, dereference: true })
      copied.add(source)

      const dependencyManifest = readManifest(source)
      for (const dependency of runtimeDependencies(dependencyManifest)) {
        if (bundledWorkspaceSet.has(dependency.name)) continue
        queue.push({ ...dependency, owner: source })
      }
    }

    mkdirSync(dirname(output), { recursive: true })
    execFileSync('/usr/bin/tar', ['-czf', output, '-C', staging, '.'])
    return { packageCount: copied.size + 1 }
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}
