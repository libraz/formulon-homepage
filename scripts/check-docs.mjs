import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src')
const output = join(root, '.vitepress/dist')
const walk = (directory, suffix) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path, suffix) : path.endsWith(suffix) ? [path] : []
  })
const pages = walk(source, '.md').map((path) => relative(source, path))
const english = new Set(pages.filter((path) => !path.startsWith('ja/')))
const japanese = new Set(
  pages.filter((path) => path.startsWith('ja/')).map((path) => path.slice(3))
)
const problems = []
for (const page of english) if (!japanese.has(page)) problems.push(`Missing Japanese page: ${page}`)
for (const page of japanese) if (!english.has(page)) problems.push(`Missing English page: ${page}`)
if (!existsSync(output))
  throw new Error('Build the site before checking its rendered routes and anchors.')
const documents = new Map(walk(output, '.html').map((path) => [path, readFileSync(path, 'utf8')]))
const ids = new Map(
  [...documents].map(([path, html]) => [
    path,
    new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]))
  ])
)
const decode = (text) =>
  text.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"')
let links = 0
for (const [path, html] of documents) {
  const pageUrl = new URL(relative(output, path), 'https://docs.invalid/')
  for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
    const href = decode(match[1])
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue
    const target = new URL(href, pageUrl)
    let destination = join(output, decodeURIComponent(target.pathname))
    if (target.pathname.endsWith('/')) destination = join(destination, 'index.html')
    else if (!extname(destination)) destination += '.html'
    links += 1
    if (!existsSync(destination)) {
      problems.push(`${relative(output, path)}: missing target ${href}`)
    } else if (
      target.hash &&
      documents.has(destination) &&
      !ids.get(destination).has(decodeURIComponent(target.hash.slice(1)))
    ) {
      problems.push(`${relative(output, path)}: missing anchor ${href}`)
    }
  }
}
for (const page of pages) {
  const built = join(output, page.replace(/\.md$/, '.html'))
  if (!documents.has(built)) problems.push(`Missing rendered page: ${page}`)
}
if (problems.length) {
  console.error([...new Set(problems)].join('\n'))
  process.exitCode = 1
} else
  console.log(
    `Docs check passed: ${english.size} English / ${japanese.size} Japanese pages, ${documents.size} HTML routes, ${links} local links and anchors.`
  )
