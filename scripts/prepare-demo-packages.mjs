import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const core = resolve('../formulon')
const cell = resolve('../formulon-cell')
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' })
const git = (repo, args) =>
  execFileSync('git', ['-C', repo, ...args], { maxBuffer: 64 * 1024 * 1024 })
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const inputPaths = new Map([
  [core, ['src', 'cmake', 'CMakeLists.txt', 'packages/npm']],
  [
    cell,
    [
      'packages/formulon-cell',
      'packages/formulon-cell-vue',
      'package.json',
      'yarn.lock',
      '.yarnrc.yml',
      'tsconfig.base.json'
    ]
  ]
])

async function sourceState(repo) {
  // Hash contents as well as paths, including new source files absent from git diff.
  const files = [
    ...new Set(
      git(repo, [
        'ls-files',
        '-z',
        '--cached',
        '--others',
        '--exclude-standard',
        '--',
        ...inputPaths.get(repo)
      ])
        .toString()
        .split('\0')
        .filter(Boolean)
    )
  ].sort()
  const digest = createHash('sha256')
  for (const file of files) {
    digest.update(`${file}\0`)
    try {
      digest.update(await readFile(join(repo, file)))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      digest.update('missing\0')
    }
  }
  return {
    sourceCommit: git(repo, ['rev-parse', 'HEAD']).toString().trim(),
    sourceDiffSha256: hash(git(repo, ['diff', 'HEAD'])),
    sourceInputsSha256: digest.digest('hex'),
    sourceInputCount: files.length
  }
}

const before = new Map(
  await Promise.all([core, cell].map(async (repo) => [repo, await sourceState(repo)]))
)
const wasmFiles = ['formulon.wasm', 'formulon_threads.wasm']
const oldestWasm = Math.min(
  ...(await Promise.all(
    wasmFiles.map(async (name) => (await stat(join(core, 'packages/npm/dist', name))).mtimeMs)
  ))
)
for (const file of git(core, [
  'ls-files',
  '-z',
  '--cached',
  '--others',
  '--exclude-standard',
  '--',
  'src',
  'cmake',
  'CMakeLists.txt'
])
  .toString()
  .split('\0')
  .filter(Boolean)) {
  if ((await stat(join(core, file))).mtimeMs > oldestWasm)
    throw new Error(
      `${file} is newer than the staged WASM. Rebuild and stage both core variants first.`
    )
}
const { default: createEngine } = await import('../../formulon/packages/npm/dist/formulon.js')
const module = await createEngine()
const workbook = module.Workbook.createDefault()
try {
  const expected = JSON.parse(
    await readFile(join(core, 'packages/npm/package.json'), 'utf8')
  ).version
  const translation = workbook.localizeFormula('=SUM(1,2.5)', 'mac-365-de_DE')
  if (
    module.version() !== expected ||
    !translation.status.ok ||
    translation.value !== '=SUMME(1;2,5)'
  )
    throw new Error('The staged engine does not match the current language API.')
} finally {
  workbook.delete()
}

const buildRoot = await realpath(await mkdtemp(join(tmpdir(), 'formulon-docs-build-')))
try {
  // Capture source before building: sibling work may continue while Vite runs.
  const frozenCell = join(buildRoot, 'source')
  const cellFiles = git(cell, [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    ...inputPaths.get(cell),
    'tsconfig.base.json'
  ])
    .toString()
    .split('\0')
    .filter(Boolean)
  for (const file of new Set(cellFiles)) {
    const destination = join(frozenCell, file)
    await mkdir(dirname(destination), { recursive: true })
    try {
      await cp(join(cell, file), destination)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  if ((await sourceState(cell)).sourceInputsSha256 !== before.get(cell).sourceInputsSha256)
    throw new Error('Cell source changed while being copied. Retry the snapshot capture.')
  for (const directory of ['', 'packages/formulon-cell', 'packages/formulon-cell-vue'])
    await symlink(
      join(cell, directory, 'node_modules'),
      join(frozenCell, directory, 'node_modules')
    )
  run(
    process.execPath,
    [join(cell, 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', 'tsconfig.build.json'],
    join(frozenCell, 'packages/formulon-cell')
  )
  run(
    process.execPath,
    [
      join(cell, 'packages/formulon-cell/node_modules/vite/bin/vite.js'),
      'build',
      '--outDir',
      join(buildRoot, 'cell')
    ],
    join(frozenCell, 'packages/formulon-cell')
  )
  // Resolve adapter declarations against the output built above, never an old
  // dist/ directory left in the sibling workspace.
  const vueConfig = join(buildRoot, 'vue.tsconfig.json')
  await writeFile(
    vueConfig,
    JSON.stringify({
      extends: join(frozenCell, 'packages/formulon-cell-vue/tsconfig.json'),
      compilerOptions: {
        rootDir: join(frozenCell, 'packages/formulon-cell-vue/src'),
        paths: {
          '@libraz/formulon-cell': [join(buildRoot, 'cell/index.d.ts')],
          '@libraz/formulon-cell/*': [join(buildRoot, 'cell/*.d.ts')]
        }
      },
      include: [join(frozenCell, 'packages/formulon-cell-vue/src/**/*')]
    })
  )
  run(
    process.execPath,
    [
      join(cell, 'packages/formulon-cell-vue/node_modules/tsup/dist/cli-default.js'),
      '--tsconfig',
      vueConfig,
      '--out-dir',
      join(buildRoot, 'vue')
    ],
    join(frozenCell, 'packages/formulon-cell-vue')
  )
  const cellVersion = JSON.parse(
    await readFile(join(frozenCell, 'packages/formulon-cell/package.json'), 'utf8')
  ).version
  const definitions = [
    ['formulon', core, 'packages/npm', join(core, 'packages/npm/dist')],
    ['formulon-cell', cell, 'packages/formulon-cell', join(buildRoot, 'cell')],
    ['formulon-cell-vue', cell, 'packages/formulon-cell-vue', join(buildRoot, 'vue')]
  ]
  const records = []
  for (const [name, repo, subdir, dist] of definitions) {
    const source = join(repo === cell ? frozenCell : repo, subdir)
    const stage = join(buildRoot, name)
    const pkg = join(stage, 'package')
    await mkdir(pkg, { recursive: true })
    const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
    if (manifest.dependencies?.['@libraz/formulon-cell'] === 'workspace:*')
      manifest.dependencies['@libraz/formulon-cell'] = cellVersion
    await writeFile(join(pkg, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await cp(dist, join(pkg, 'dist'), { recursive: true })
    for (const file of manifest.files.filter((file) => !file.startsWith('dist'))) {
      try {
        await cp(join(source, file), join(pkg, file), { recursive: true })
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    await cp(join(source, 'LICENSE'), join(pkg, 'LICENSE'))
    if (name === 'formulon') await cp(join(source, 'NOTICE'), join(pkg, 'NOTICE'))
    if (name === 'formulon-cell')
      await cp(join(source, 'src/styles'), join(pkg, 'dist/styles'), { recursive: true })
    const archive = `${name}-docs.tgz`
    run('tar', ['-czf', join(buildRoot, archive), '-C', stage, 'package'])
    records.push({
      name: manifest.name,
      version: manifest.version,
      archive,
      sha256: hash(await readFile(join(buildRoot, archive))),
      sourceRepository: name === 'formulon' ? 'formulon' : 'formulon-cell',
      ...before.get(repo)
    })
  }
  for (const repo of [core]) {
    const after = await sourceState(repo)
    const initial = before.get(repo)
    if (
      after.sourceCommit !== initial.sourceCommit ||
      after.sourceInputsSha256 !== initial.sourceInputsSha256
    )
      throw new Error(
        `${repo}: source inputs changed while snapshots were built. Retry after the sibling edits settle.`
      )
  }
  const out = join(root, 'vendor')
  await mkdir(out, { recursive: true })
  // Publish only complete archives after all source consistency checks pass.
  for (const record of records)
    await rename(join(buildRoot, record.archive), join(out, record.archive))
  await writeFile(
    join(out, 'manifest.json'),
    `${JSON.stringify({ purpose: 'Prepared source snapshots for the current documentation demos; not registry releases.', packages: records }, null, 2)}\n`
  )
  console.log(
    'Prepared three package snapshots. Run yarn check:demos, yarn test:local and yarn build:local before accepting them.'
  )
} finally {
  await rm(buildRoot, { recursive: true, force: true })
}
