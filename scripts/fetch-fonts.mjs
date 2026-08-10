#!/usr/bin/env node
/**
 * Mirrors the web fonts used by the site into `src/public/fonts/` and
 * regenerates `.vitepress/theme/styles/fonts.css` from the mirrored files.
 *
 * Self-hosting removes the last cross-origin subresource from the document,
 * which is what lets the site send `Cross-Origin-Embedder-Policy: require-corp`
 * (required for the SharedArrayBuffer the Formulon WASM engine runs on, and
 * the only COEP value Safari implements).
 *
 * The run is idempotent: a face is re-downloaded only when it is missing or
 * when the upstream URL recorded in `scripts/fonts.lock.json` changed. Pass
 * `--force` to re-download everything.
 *
 * Usage: node scripts/fetch-fonts.mjs [--force]
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fontsDir = resolve(rootDir, 'src/public/fonts')
const cssFile = resolve(rootDir, '.vitepress/theme/styles/fonts.css')
const lockFile = resolve(rootDir, 'scripts/fonts.lock.json')

/**
 * Families to mirror, in the order they are emitted into fonts.css. `italics`
 * lists the weights additionally needed in the italic style.
 *
 * Inter is deliberately absent: the VitePress default theme already self-hosts
 * it under `vitepress/dist/client/theme-default/fonts/`.
 *
 * "IBM Plex Sans" and "IBM Plex Sans JP" are separate families — the former
 * carries the Latin text faces, the latter the Japanese fallback.
 */
const FAMILIES = [
  { family: 'Outfit', slug: 'outfit', weights: [600, 700] },
  { family: 'Geist', slug: 'geist', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'JetBrains Mono', slug: 'jetbrains-mono', weights: [400, 500, 600, 700] },
  { family: 'IBM Plex Sans', slug: 'ibm-plex-sans', weights: [400, 500, 600, 700], italics: [400] },
  { family: 'IBM Plex Sans JP', slug: 'ibm-plex-sans-jp', weights: [400, 500, 700] }
]

/** Google Fonts only serves woff2 to a User-Agent it recognises as a modern browser. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const DOWNLOAD_CONCURRENCY = 12

/** Matches one `@font-face` block plus the subset comment Google emits before it. */
const FACE_PATTERN = /(?:\/\*\s*([^*]+?)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g

const cssUrl = ({ family, weights, italics }) => {
  const name = encodeURIComponent(family).replace(/%20/g, '+')
  const axes = italics?.length
    ? `ital,wght@${[...weights.map((w) => `0,${w}`), ...italics.map((w) => `1,${w}`)].join(';')}`
    : `wght@${weights.join(';')}`
  return `https://fonts.googleapis.com/css2?family=${name}:${axes}&display=swap`
}

const fetchText = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`)
  return response.text()
}

const fetchBinary = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

const declaration = (block, property) => {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([^;]+)`))
  return match ? match[1].trim() : undefined
}

/**
 * Names a subset. Named Latin/Cyrillic subsets carry a comment; the CJK
 * subsets Google splits IBM Plex Sans JP into are only identified by the
 * numeric suffix on their file name.
 */
const subsetName = (comment, url, index) => {
  if (comment) return comment.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const numbered = url.match(/\.(\d+)\.woff2$/)
  return numbered ? `s${numbered[1]}` : `s${index}`
}

const parseFaces = (css) => {
  const faces = []
  for (const match of css.matchAll(FACE_PATTERN)) {
    const [, comment, block] = match
    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1]
    if (!url) continue
    faces.push({
      url,
      subset: subsetName(comment, url, faces.length),
      weight: declaration(block, 'font-weight') ?? '400',
      style: declaration(block, 'font-style') ?? 'normal',
      unicodeRange: declaration(block, 'unicode-range')
    })
  }
  return faces
}

/**
 * Assigns each face a local file name. Variable-font families serve one file
 * for several weights, so faces sharing a URL share a file; the weight is only
 * added to the name when a subset genuinely differs per weight.
 */
const assignFileNames = (faces) => {
  const byStem = new Map()
  for (const face of faces) {
    const stem = face.style === 'normal' ? face.subset : `${face.subset}-${face.style}`
    const group = byStem.get(stem)
    if (group) group.push(face)
    else byStem.set(stem, [face])
  }
  for (const [stem, group] of byStem) {
    const shared = new Set(group.map((face) => face.url)).size === 1
    for (const face of group) {
      face.fileName = shared ? `${stem}.woff2` : `${stem}-${face.weight}.woff2`
    }
  }
}

const runWithConcurrency = async (items, limit, worker) => {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

const readLock = async () => {
  if (!existsSync(lockFile)) return {}
  try {
    return JSON.parse(await readFile(lockFile, 'utf8'))
  } catch {
    return {}
  }
}

/** Drops mirrored files that the current family list no longer references. */
const pruneStaleFiles = async (slug, keep) => {
  const dir = join(fontsDir, slug)
  if (!existsSync(dir)) return
  for (const entry of await readdir(dir)) {
    if (!keep.has(entry)) await rm(join(dir, entry))
  }
}

const renderCss = (families) => {
  const header = [
    // The formatter would rewrap the long unicode-range lists; this file is
    // regenerated rather than hand-edited, so it is exempted instead.
    '/** biome-ignore-all format: generated by scripts/fetch-fonts.mjs */',
    '',
    '/*',
    '  Self-hosted web fonts, generated by scripts/fetch-fonts.mjs.',
    '  Run `yarn fonts:fetch` to regenerate; do not edit this file by hand.',
    '',
    '  Self-hosting keeps the document free of cross-origin subresources, which is',
    '  what allows Cross-Origin-Embedder-Policy: require-corp — the isolation mode',
    '  the Formulon WASM engine needs for its shared memory, and the only one',
    '  Safari implements.',
    '',
    "  Inter is not declared here: VitePress's default theme already self-hosts it.",
    '*/',
    ''
  ].join('\n')

  const blocks = families.flatMap(({ family, slug, faces }) => [
    `/* ${family} */`,
    ...faces.map((face) => {
      const lines = [
        '@font-face {',
        `  font-family: "${family}";`,
        `  font-style: ${face.style};`,
        `  font-weight: ${face.weight};`,
        '  font-display: swap;',
        `  src: url("/fonts/${slug}/${face.fileName}") format("woff2");`
      ]
      if (face.unicodeRange) lines.push(`  unicode-range: ${face.unicodeRange};`)
      lines.push('}')
      return lines.join('\n')
    }),
    ''
  ])

  return `${header}\n${blocks.join('\n')}`
}

const main = async () => {
  const force = process.argv.includes('--force')
  const lock = await readLock()
  const nextLock = {}
  const families = []
  let downloaded = 0
  let totalBytes = 0

  for (const entry of FAMILIES) {
    const { family, slug } = entry
    const css = await fetchText(cssUrl(entry))
    const faces = parseFaces(css)
    if (faces.length === 0) throw new Error(`No woff2 faces found for ${family}`)
    assignFileNames(faces)

    const dir = join(fontsDir, slug)
    await mkdir(dir, { recursive: true })

    const unique = new Map()
    for (const face of faces) unique.set(face.fileName, face.url)

    await runWithConcurrency([...unique], DOWNLOAD_CONCURRENCY, async ([fileName, url]) => {
      const target = join(dir, fileName)
      const key = `${slug}/${fileName}`
      if (!force && existsSync(target) && lock[key] === url) return
      await writeFile(target, await fetchBinary(url))
      downloaded += 1
    })

    for (const [fileName, url] of unique) nextLock[`${slug}/${fileName}`] = url

    await pruneStaleFiles(slug, new Set(unique.keys()))

    const bytes = (
      await Promise.all(
        [...unique.keys()].map(async (fileName) => (await readFile(join(dir, fileName))).byteLength)
      )
    ).reduce((sum, size) => sum + size, 0)
    totalBytes += bytes
    families.push({ family, slug, faces })

    const megabytes = (bytes / 1024 / 1024).toFixed(2)
    console.log(`${family}: ${unique.size} files, ${megabytes} MB`)
  }

  await mkdir(dirname(cssFile), { recursive: true })
  await writeFile(cssFile, renderCss(families))
  await writeFile(lockFile, `${JSON.stringify(nextLock, null, 2)}\n`)

  console.log(
    `total ${(totalBytes / 1024 / 1024).toFixed(2)} MB, ${downloaded} file(s) downloaded, wrote ${relative(rootDir, cssFile)}`
  )
}

await main()
