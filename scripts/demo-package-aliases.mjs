import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vendorRoot = join(root, 'vendor')
const packageCacheRoot = join(vendorRoot, 'packages')
const cacheMarker = '.formulon-docs-snapshot-sha256'

/** @typedef {{ find: RegExp, replacement: string }} DemoPackageAlias */

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

const within = (parent, candidate) => {
  const parentPath = resolve(parent)
  const candidatePath = resolve(candidate)
  return candidatePath === parentPath || candidatePath.startsWith(`${parentPath}${sep}`)
}

const fail = (message) => {
  throw new Error(`[FORMULON_DEMO_SOURCE=local] ${message}. Run yarn demos:prepare and retry.`)
}

const readSnapshotManifest = () => {
  const manifestPath = join(vendorRoot, 'manifest.json')
  if (!existsSync(manifestPath)) fail(`missing ${manifestPath}`)

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    fail(`cannot read ${manifestPath}: ${error.message}`)
  }
  if (!Array.isArray(manifest?.packages) || manifest.packages.length === 0)
    fail(`${manifestPath} does not contain a package list`)

  const names = new Set()
  for (const pkg of manifest.packages) {
    if (
      !pkg ||
      typeof pkg.name !== 'string' ||
      typeof pkg.version !== 'string' ||
      typeof pkg.archive !== 'string' ||
      typeof pkg.sha256 !== 'string'
    )
      fail(`${manifestPath} contains an invalid package record`)
    if (names.has(pkg.name)) fail(`${manifestPath} contains duplicate package ${pkg.name}`)
    names.add(pkg.name)
    if (pkg.name.includes('..') || pkg.archive.includes('..') || pkg.archive.includes('/'))
      fail(`${manifestPath} contains an unsafe package path`)
  }
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const expectedNames = Object.keys(packageJson.dependencies).filter((name) =>
    name.startsWith('@libraz/formulon')
  )
  if (names.size !== expectedNames.length || expectedNames.some((name) => !names.has(name)))
    fail(`${manifestPath} must cover every Formulon dependency exactly once`)
  return manifest
}

const packageDirFor = (name) => {
  const packageDir = resolve(packageCacheRoot, name)
  if (!within(packageCacheRoot, packageDir)) fail(`unsafe package path for ${name}`)
  return packageDir
}

const unpackSnapshot = (pkg) => {
  const archive = resolve(vendorRoot, pkg.archive)
  if (!within(vendorRoot, archive) || !existsSync(archive))
    fail(`missing snapshot archive ${archive}`)

  const actualSha = sha256(readFileSync(archive))
  if (actualSha !== pkg.sha256)
    fail(`${pkg.archive} checksum ${actualSha} does not match ${pkg.sha256}`)

  const packageDir = packageDirFor(pkg.name)
  const markerPath = join(packageDir, cacheMarker)
  let cached = false
  if (existsSync(markerPath)) {
    try {
      const packageManifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
      cached =
        readFileSync(markerPath, 'utf8').trim() === pkg.sha256 &&
        packageManifest.name === pkg.name &&
        packageManifest.version === pkg.version
    } catch {
      cached = false
    }
  }

  if (!cached) {
    rmSync(packageDir, { recursive: true, force: true })
    mkdirSync(packageDir, { recursive: true })
    try {
      execFileSync('tar', ['-xzf', archive, '-C', packageDir, '--strip-components=1'])
      writeFileSync(markerPath, `${pkg.sha256}\n`)
    } catch (error) {
      rmSync(packageDir, { recursive: true, force: true })
      fail(`cannot unpack ${pkg.archive}: ${error.message}`)
    }
  }

  const packageManifestPath = join(packageDir, 'package.json')
  if (!existsSync(packageManifestPath)) fail(`${pkg.name} snapshot has no package.json`)
  let packageManifest
  try {
    packageManifest = JSON.parse(readFileSync(packageManifestPath, 'utf8'))
  } catch (error) {
    fail(`cannot read unpacked ${pkg.name} package.json: ${error.message}`)
  }
  if (packageManifest.name !== pkg.name || packageManifest.version !== pkg.version)
    fail(`${pkg.archive} package metadata does not match its snapshot manifest`)
  return { packageDir, packageManifest }
}

const escapeRegExp = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')

const exportTarget = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = exportTarget(item)
      if (target) return target
    }
    return undefined
  }
  if (!value || typeof value !== 'object') return undefined
  for (const condition of ['import', 'browser', 'node', 'default', 'require']) {
    const target = exportTarget(value[condition])
    if (target) return target
  }
  return undefined
}

const aliasesForPackage = (name, packageDir, packageManifest) => {
  const entries = Object.entries(packageManifest.exports ?? {})
  const aliases = []
  for (const [exportName, exportValue] of entries) {
    const target = exportTarget(exportValue)
    if (!target?.startsWith('./')) continue
    const specifier = exportName === '.' ? name : `${name}/${exportName.slice(2)}`
    const targetPath = target.slice(2)
    const wildcardIndexes = []
    let pattern = ''
    let cursor = 0
    for (const match of specifier.matchAll(/\*/g)) {
      pattern += escapeRegExp(specifier.slice(cursor, match.index))
      wildcardIndexes.push(wildcardIndexes.length + 1)
      pattern += '(.+)'
      cursor = match.index + 1
    }
    pattern += escapeRegExp(specifier.slice(cursor))
    let replacement = join(packageDir, targetPath)
    for (const index of wildcardIndexes) replacement = replacement.replace('*', `$${index}`)
    const isWildcard = wildcardIndexes.length > 0
    const targetExists = !isWildcard && existsSync(join(packageDir, targetPath))
    if (!isWildcard && !targetExists)
      fail(`${name} export ${exportName} points to missing ${target}`)
    aliases.push({
      find: new RegExp(`^${pattern}$`),
      replacement,
      specificity: specifier.length
    })
  }
  // Keep narrow export aliases before the package root. This also protects
  // future package exports if a consumer uses a non-anchored Vite alias.
  return aliases
    .sort((left, right) => right.specificity - left.specificity)
    .map(({ find, replacement }) => ({ find, replacement }))
}

/**
 * Prepare local package snapshots and return Vite-compatible aliases.
 * Registry mode intentionally performs no filesystem work and returns no aliases.
 */
export const loadDemoPackageAliases = () => {
  if (process.env.FORMULON_DEMO_SOURCE !== 'local')
    return { aliases: /** @type {DemoPackageAlias[]} */ ([]), packageRoots: new Map() }

  const manifest = readSnapshotManifest()
  const aliases = []
  const packageRoots = new Map()
  for (const pkg of manifest.packages) {
    const { packageDir, packageManifest } = unpackSnapshot(pkg)
    packageRoots.set(pkg.name, packageDir)
    aliases.push(...aliasesForPackage(pkg.name, packageDir, packageManifest))
  }
  return { aliases, packageRoots }
}
