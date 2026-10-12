import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vendor = join(root, 'vendor')
const manifestPath = join(vendor, 'manifest.json')

const fail = (message) => {
  throw new Error(`Demo package check failed: ${message}`)
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`)
  }
}

if (!existsSync(manifestPath)) fail(`missing ${manifestPath}`)
const manifest = readJson(manifestPath)
const packageJson = readJson(join(root, 'package.json'))
if (!Array.isArray(manifest.packages) || manifest.packages.length === 0)
  fail('the snapshot manifest has no packages')

const expectedNames = Object.keys(packageJson.dependencies).filter((name) =>
  name.startsWith('@libraz/formulon')
)
const recordedNames = new Set()
if (expectedNames.length !== 3) fail('package.json must list the three Formulon demo packages')

for (const name of expectedNames) {
  const dependency = packageJson.dependencies[name]
  const resolution = packageJson.resolutions?.[name]
  if (!/^\d+\.\d+\.\d+$/.test(dependency))
    fail(`${name} must use an exact registry version, found ${dependency}`)
  if (resolution !== dependency)
    fail(`${name} resolution ${resolution ?? '<missing>'} does not match ${dependency}`)
}

for (const pkg of manifest.packages) {
  if (
    !pkg ||
    typeof pkg.name !== 'string' ||
    typeof pkg.version !== 'string' ||
    typeof pkg.archive !== 'string' ||
    typeof pkg.sha256 !== 'string'
  )
    fail('the snapshot manifest contains an invalid package record')
  if (recordedNames.has(pkg.name)) fail(`duplicate package ${pkg.name} in the snapshot manifest`)
  recordedNames.add(pkg.name)
  if (!expectedNames.includes(pkg.name)) fail(`unexpected package ${pkg.name} in the snapshot manifest`)

  const archive = join(vendor, pkg.archive)
  if (!existsSync(archive)) fail(`missing snapshot archive ${archive}`)
  const bytes = readFileSync(archive)
  const sha = createHash('sha256').update(bytes).digest('hex')
  if (sha !== pkg.sha256)
    fail(`${pkg.archive} checksum ${sha} does not match recorded ${pkg.sha256}`)

  let archivePackage
  try {
    archivePackage = JSON.parse(
      execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' })
    )
  } catch (error) {
    fail(`cannot read package metadata from ${pkg.archive}: ${error.message}`)
  }
  if (archivePackage.name !== pkg.name || archivePackage.version !== pkg.version)
    fail(`${pkg.archive} package metadata does not match its manifest record`)
}

if (recordedNames.size !== expectedNames.length)
  fail('the snapshot manifest must cover each Formulon dependency exactly once')

console.log(
  `Demo snapshot check passed: ${manifest.packages.length} archives and registry dependency names.`
)

