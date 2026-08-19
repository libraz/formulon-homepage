import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import { generateLlmsTxt, type LlmsLocale, llmsDevPlugin } from './llms'

const siteUrl = 'https://formulon.libraz.net'
const githubUrl = 'https://github.com/libraz/formulon'
const docsVersion = '0.10.0'
const docsVersionTag = `v${docsVersion}`
const changelogUrl = `${githubUrl}/blob/main/CHANGELOG.md`

const applyCrossOriginIsolationHeaders = (
  _req: unknown,
  res: { setHeader: (name: string, value: string) => void },
  next: () => void
) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
}

// Rollup cannot statically analyse the Emscripten pthread spawn site, so the
// options argument is marked with @vite-ignore. The spawn site moved between
// engine versions: older builds used dist/formulon.js, while newer builds use
// that file as a thin ESM shim and place the generated module in dist/formulon_core.js.
// Both filenames are patched so either layout — including the nested copy
// formulon-cell may carry — is covered.
const patchFormulonWorkerOptions = () => {
  const distFiles = [
    'node_modules/@libraz/formulon/dist/formulon.js',
    'node_modules/@libraz/formulon/dist/formulon_core.js',
    'node_modules/@libraz/formulon-cell/node_modules/@libraz/formulon/dist/formulon.js',
    'node_modules/@libraz/formulon-cell/node_modules/@libraz/formulon/dist/formulon_core.js'
  ]
  const files = distFiles.map((file) => resolve(process.cwd(), file))

  for (const file of files) {
    if (!existsSync(file)) continue
    const before = readFileSync(file, 'utf8')
    const after = before
      .replaceAll('/* -ignore */', '/* @vite-ignore */')
      .replaceAll(
        'new Worker(new URL("formulon.js",import.meta.url),workerOptions)',
        'new Worker(new URL("formulon.js",import.meta.url),/* @vite-ignore */ workerOptions)'
      )
      .replaceAll(
        'new Worker(new URL("formulon.js",import.meta.url),{type:"module",workerData:"em-pthread",name:"em-pthread"})',
        'new Worker(new URL("formulon.js",import.meta.url),/* @vite-ignore */ {type:"module",workerData:"em-pthread",name:"em-pthread"})'
      )
    if (after !== before) writeFileSync(file, after)
  }
}

patchFormulonWorkerOptions()

/** Per-locale structured data and social-card copy. */
type Locale = 'en' | 'ja'

const softwareApplicationJsonLd = (lang: Locale) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Formulon',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Linux, macOS, Windows, WebAssembly',
  inLanguage: lang,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    lang === 'ja'
      ? 'C++17 コアのヘッドレスな Excel 互換計算エンジン。WebAssembly、ネイティブ Node、Python、CLI から利用できます。'
      : 'Headless Excel-compatible calculation engine with a C++17 core, exposed through WebAssembly, Native Node, Python, and CLI surfaces.',
  url: lang === 'ja' ? `${siteUrl}/ja/` : siteUrl,
  downloadUrl: githubUrl,
  softwareVersion: docsVersion,
  author: { '@type': 'Person', name: 'libraz' },
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  keywords:
    lang === 'ja'
      ? 'Excel, スプレッドシート, 数式エンジン, 計算エンジン, XLSX, XLSB, WebAssembly, Python, C++17'
      : 'Excel, spreadsheet, formula engine, calculation engine, XLSX, XLSB, WebAssembly, Python, C++17'
})

const SEO: Record<Locale, { title: string; description: string; keywords: string }> = {
  en: {
    title: 'Formulon - Excel-compatible calculation engine',
    description:
      'A headless C++17 spreadsheet calculation engine packaged for WebAssembly, Native Node, Python, and CLI workflows.',
    keywords:
      'Excel, spreadsheet, formula engine, calculation engine, XLSX, XLSB, WebAssembly, Python, C++17'
  },
  ja: {
    title: 'Formulon - Excel 互換の計算エンジン',
    description:
      'ヘッドレスな C++17 スプレッドシート計算エンジン。WebAssembly、ネイティブ Node、Python、CLI 向けにパッケージされています。',
    keywords:
      'Excel, スプレッドシート, 数式エンジン, 計算エンジン, XLSX, XLSB, WebAssembly, Python, C++17, Excel 互換'
  }
}

/** `ja/start/install.md` -> `/ja/start/install`, `index.md` -> `/` */
function routeOf(relativePath: string): string {
  const clean = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
  return `/${clean}`.replace(/\/{2,}/g, '/')
}

const localeOf = (relativePath: string): Locale => (relativePath.startsWith('ja/') ? 'ja' : 'en')

/** The same page in the other language. */
function alternateRoute(relativePath: string): string {
  return relativePath.startsWith('ja/')
    ? routeOf(relativePath.slice(3))
    : routeOf(`ja/${relativePath}`)
}

const startSidebar = [
  {
    text: 'Start',
    items: [
      { text: 'Overview', link: '/start/' },
      { text: 'Install', link: '/start/install' },
      { text: 'Evaluate a formula', link: '/start/evaluate' },
      { text: 'Recalculate a workbook', link: '/start/recalculate' },
      { text: 'Troubleshooting', link: '/start/troubleshooting' }
    ]
  },
  {
    text: 'Next steps',
    items: [
      { text: 'Why Formulon', link: '/why' },
      { text: 'Choose a surface', link: '/start/choose-runtime' },
      { text: 'Formula coverage', link: '/compatibility/formula-coverage' },
      { text: 'File format support', link: '/compatibility/file-format-support' },
      { text: 'FAQ', link: '/faq' }
    ]
  }
]

const useCasesSidebar = [
  {
    text: 'Use cases',
    items: [
      { text: 'Overview', link: '/scenarios/' },
      { text: 'Browser workbook upload', link: '/scenarios/browser-upload' },
      { text: 'Node service recalculation', link: '/scenarios/node-service' },
      { text: 'Python batch recalculation', link: '/scenarios/python-batch' },
      { text: 'CI workbook regression', link: '/scenarios/ci-regression' }
    ]
  }
]

const runtimesSidebar = [
  {
    text: 'Runtimes',
    items: [
      { text: 'Overview', link: '/runtimes/' },
      { text: 'WASM / browser', link: '/runtimes/wasm' },
      { text: 'Python', link: '/runtimes/python' },
      { text: 'Native Node', link: '/runtimes/node-native' },
      { text: 'CLI', link: '/runtimes/cli' },
      { text: 'CI regression', link: '/runtimes/ci-regression' }
    ]
  },
  {
    text: 'API details',
    items: [
      { text: 'Overview', link: '/api/' },
      { text: 'Package surfaces', link: '/api/surfaces' },
      { text: 'C API', link: '/api/c' },
      { text: 'WASM API', link: '/api/wasm' },
      { text: 'Python API', link: '/api/python' },
      { text: 'CLI reference', link: '/api/cli' }
    ]
  }
]

const compatibilitySidebar = [
  {
    text: 'Compatibility',
    items: [
      { text: 'Overview', link: '/compatibility/' },
      { text: 'Compatibility model', link: '/compatibility/model' },
      { text: 'Locale profiles', link: '/compatibility/locale-profiles' },
      { text: 'Formula coverage', link: '/compatibility/formula-coverage' },
      { text: 'File format support', link: '/compatibility/file-format-support' },
      { text: 'Error model', link: '/compatibility/errors' },
      { text: 'Oracle testing', link: '/compatibility/oracle-testing' },
      { text: 'Non-goals', link: '/compatibility/non-goals' }
    ]
  }
]

const workbookSidebar = [
  {
    text: 'Workbook',
    items: [
      { text: 'Overview', link: '/workbook/' },
      { text: 'Formula engine', link: '/workbook/formula-engine' },
      { text: 'Recalculation', link: '/workbook/recalculation' },
      { text: 'Operations', link: '/workbook/operations' },
      { text: 'Dynamic arrays', link: '/workbook/dynamic-arrays' },
      { text: 'File formats', link: '/workbook/file-formats' },
      { text: 'PivotTables', link: '/workbook/pivots' },
      { text: 'Lifecycle', link: '/workbook/lifecycle' }
    ]
  }
]

const cellSidebar = [
  {
    text: 'formulon-cell',
    items: [
      { text: 'What it is', link: '/cell/' },
      { text: 'Full demo', link: '/cell/demo' },
      { text: 'Install', link: '/cell/install' },
      { text: 'Bundler setup', link: '/cell/bundler' },
      { text: 'Embedding guide', link: '/cell/embedding' },
      { text: 'Extension catalogue', link: '/cell/extensions' },
      { text: 'Theming', link: '/cell/theming' },
      { text: 'Framework adapters', link: '/cell/frameworks' },
      { text: 'Host integration', link: '/cell/host-integration' },
      { text: 'i18n', link: '/cell/i18n' },
      { text: 'API surface', link: '/cell/api' }
    ]
  }
]

const mcpSidebar = [
  {
    text: 'formulon-mcp',
    items: [
      { text: 'Overview', link: '/mcp/' },
      { text: 'Install', link: '/mcp/install' },
      { text: 'Workflow', link: '/mcp/workflow' },
      { text: 'Tools', link: '/mcp/tools' },
      { text: 'Security model', link: '/mcp/security' }
    ]
  }
]

const developmentSidebar = [
  {
    text: 'Development',
    items: [
      { text: 'Overview', link: '/development/' },
      { text: 'C++ core', link: '/development/core' },
      { text: 'Architecture', link: '/development/architecture' },
      { text: 'Bindings', link: '/development/bindings' },
      { text: 'Build from source', link: '/development/build-from-source' },
      { text: 'Test matrix', link: '/development/test-matrix' },
      { text: 'Oracle contribution', link: '/development/oracle-contribution' },
      { text: 'Size budgets', link: '/development/size-budgets' },
      { text: 'Release checklist', link: '/development/release-checklist' }
    ]
  }
]

const jaStartSidebar = [
  {
    text: 'はじめる',
    items: [
      { text: '概要', link: '/ja/start/' },
      { text: 'インストール', link: '/ja/start/install' },
      { text: '数式を評価する', link: '/ja/start/evaluate' },
      { text: 'ワークブックを再計算する', link: '/ja/start/recalculate' },
      { text: 'トラブルシュート', link: '/ja/start/troubleshooting' }
    ]
  },
  {
    text: '次のステップ',
    items: [
      { text: 'Formulon が必要な理由', link: '/ja/why' },
      { text: '実行入口を選ぶ', link: '/ja/start/choose-runtime' },
      { text: '数式カバレッジ', link: '/ja/compatibility/formula-coverage' },
      { text: 'ファイル形式サポート', link: '/ja/compatibility/file-format-support' },
      { text: 'FAQ', link: '/ja/faq' }
    ]
  }
]

const jaUseCasesSidebar = [
  {
    text: '利用例',
    items: [
      { text: '概要', link: '/ja/scenarios/' },
      { text: 'ブラウザで開く', link: '/ja/scenarios/browser-upload' },
      { text: 'Node サービスで再計算', link: '/ja/scenarios/node-service' },
      { text: 'Python で一括再計算', link: '/ja/scenarios/python-batch' },
      { text: 'CI で回帰検査', link: '/ja/scenarios/ci-regression' }
    ]
  }
]

const jaRuntimesSidebar = [
  {
    text: '実行環境',
    items: [
      { text: '概要', link: '/ja/runtimes/' },
      { text: 'WASM / ブラウザ', link: '/ja/runtimes/wasm' },
      { text: 'Python', link: '/ja/runtimes/python' },
      { text: 'Native Node', link: '/ja/runtimes/node-native' },
      { text: 'CLI', link: '/ja/runtimes/cli' },
      { text: 'CI 回帰検査', link: '/ja/runtimes/ci-regression' }
    ]
  },
  {
    text: 'API 詳細',
    items: [
      { text: '概要', link: '/ja/api/' },
      { text: 'パッケージと実行入口', link: '/ja/api/surfaces' },
      { text: 'C API', link: '/ja/api/c' },
      { text: 'WASM API', link: '/ja/api/wasm' },
      { text: 'Python API', link: '/ja/api/python' },
      { text: 'CLI リファレンス', link: '/ja/api/cli' }
    ]
  }
]

const jaCompatibilitySidebar = [
  {
    text: '互換性',
    items: [
      { text: '概要', link: '/ja/compatibility/' },
      { text: '互換性モデル', link: '/ja/compatibility/model' },
      { text: 'ロケールプロファイル', link: '/ja/compatibility/locale-profiles' },
      { text: '数式カバレッジ', link: '/ja/compatibility/formula-coverage' },
      { text: 'ファイル形式サポート', link: '/ja/compatibility/file-format-support' },
      { text: 'エラーモデル', link: '/ja/compatibility/errors' },
      { text: 'Oracle テスト', link: '/ja/compatibility/oracle-testing' },
      { text: '非目標', link: '/ja/compatibility/non-goals' }
    ]
  }
]

const jaWorkbookSidebar = [
  {
    text: 'ワークブック',
    items: [
      { text: '概要', link: '/ja/workbook/' },
      { text: '数式エンジン', link: '/ja/workbook/formula-engine' },
      { text: '再計算', link: '/ja/workbook/recalculation' },
      { text: '操作', link: '/ja/workbook/operations' },
      { text: '動的配列', link: '/ja/workbook/dynamic-arrays' },
      { text: 'ファイル形式', link: '/ja/workbook/file-formats' },
      { text: 'PivotTable', link: '/ja/workbook/pivots' },
      { text: 'ライフサイクル', link: '/ja/workbook/lifecycle' }
    ]
  }
]

const jaCellSidebar = [
  {
    text: 'formulon-cell',
    items: [
      { text: '位置づけ', link: '/ja/cell/' },
      { text: 'フルデモ', link: '/ja/cell/demo' },
      { text: 'インストール', link: '/ja/cell/install' },
      { text: 'バンドラ設定', link: '/ja/cell/bundler' },
      { text: '埋め込みガイド', link: '/ja/cell/embedding' },
      { text: '拡張機能一覧', link: '/ja/cell/extensions' },
      { text: 'テーマ設定', link: '/ja/cell/theming' },
      { text: 'フレームワーク連携', link: '/ja/cell/frameworks' },
      { text: 'ホスト連携', link: '/ja/cell/host-integration' },
      { text: 'i18n', link: '/ja/cell/i18n' },
      { text: 'API 一覧', link: '/ja/cell/api' }
    ]
  }
]

const jaMcpSidebar = [
  {
    text: 'formulon-mcp',
    items: [
      { text: '概要', link: '/ja/mcp/' },
      { text: 'インストール', link: '/ja/mcp/install' },
      { text: 'ワークフロー', link: '/ja/mcp/workflow' },
      { text: 'ツール一覧', link: '/ja/mcp/tools' },
      { text: 'セキュリティモデル', link: '/ja/mcp/security' }
    ]
  }
]

const jaDevelopmentSidebar = [
  {
    text: '開発',
    items: [
      { text: '概要', link: '/ja/development/' },
      { text: 'C++ コア', link: '/ja/development/core' },
      { text: 'アーキテクチャ', link: '/ja/development/architecture' },
      { text: 'バインディング', link: '/ja/development/bindings' },
      { text: 'ソースからビルド', link: '/ja/development/build-from-source' },
      { text: 'テストマトリクス', link: '/ja/development/test-matrix' },
      { text: 'Oracle 提供', link: '/ja/development/oracle-contribution' },
      { text: 'サイズ予算', link: '/ja/development/size-budgets' },
      { text: 'リリースチェックリスト', link: '/ja/development/release-checklist' }
    ]
  }
]

/** Prose for the per-locale llms.txt indexes; the page lists come from the nav/sidebar. */
const LLMS_LOCALES: LlmsLocale[] = [
  {
    key: 'root',
    prefix: '',
    title: 'Formulon',
    summary:
      'Headless Excel-compatible calculation engine for WebAssembly, native Node, Python, and the CLI. Opens a workbook, recalculates it, and reads the results back — with no spreadsheet application involved.',
    intro:
      'Formulon is a C++ core distributed to several runtimes from one implementation, so a\nformula evaluates identically in the browser, in a Node service, in a Python batch job,\nand in CI. It is a calculation engine, not a spreadsheet UI. The links below point to\nthe canonical HTML documentation.',
    overviewHeading: 'Key pages',
    homeText: 'Formulon home',
    alternate: {
      heading: 'Japanese (日本語)',
      items: [
        {
          text: '日本語版インデックス',
          link: '/ja/llms.txt',
          description: 'The same index in Japanese, covering the /ja/ documentation.'
        }
      ]
    }
  },
  {
    key: 'ja',
    prefix: '/ja',
    title: 'Formulon',
    summary:
      'WebAssembly・ネイティブ Node・Python・CLI に組み込めるヘッドレスな Excel 互換計算エンジン。ワークブックを開き、再計算し、結果を取り出す——表計算アプリを介さずに。',
    intro:
      'Formulon は単一の C++ コアを複数のランタイムへ配布する構成で、同じ数式がブラウザでも\nNode サービスでも Python の一括処理でも CI でも同じ結果になる。表計算の UI ではなく\n計算エンジンそのものを提供する。以下は日本語ドキュメントへのリンク一覧。',
    overviewHeading: '主要ページ',
    homeText: 'Formulon トップ',
    alternate: {
      heading: 'English',
      items: [
        {
          text: 'English index',
          link: '/llms.txt',
          description: '英語ドキュメントを対象とした同じ構成のインデックス。'
        }
      ]
    }
  }
]

export default defineConfig({
  srcDir: 'src',
  appearance: true,
  title: 'Formulon',
  description:
    'Headless Excel-compatible calculation engine for WebAssembly, Native Node, Python, and CLI applications.',
  cleanUrls: true,

  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    html: true
  },

  sitemap: { hostname: siteUrl },

  buildEnd(siteConfig) {
    generateLlmsTxt({
      siteUrl,
      srcDir: siteConfig.srcDir,
      outDir: siteConfig.outDir,
      cleanUrls: siteConfig.cleanUrls,
      site: siteConfig.site,
      locales: LLMS_LOCALES
    })
  },

  vite: {
    resolve: {
      // `@` points at the content root, so app-level code (the live-engine
      // demo components) sits beside the pages that embed it while
      // .vitepress/theme keeps only theme integration and presentation.
      alias: {
        '@': fileURLToPath(new URL('../src', import.meta.url))
      }
    },
    plugins: [
      llmsDevPlugin({ siteUrl, locales: LLMS_LOCALES }),
      {
        name: 'formulon-cross-origin-isolation',
        configureServer(server) {
          server.middlewares.use(applyCrossOriginIsolationHeaders)
        },
        configurePreviewServer(server) {
          server.middlewares.use(applyCrossOriginIsolationHeaders)
        }
      }
    ],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      },
      fs: {
        allow: ['..', '../..']
      }
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      }
    },
    optimizeDeps: {
      exclude: ['@libraz/formulon', '@libraz/formulon-cell']
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/katex/')) return 'katex'
            if (id.includes('/node_modules/dompurify/')) return 'dompurify'
          }
        }
      }
    },
    worker: {
      format: 'es'
    }
  },

  // Locale-independent only. Everything that differs per page or per language
  // (canonical, OGP, keywords, JSON-LD) is emitted from transformHead below.
  head: [
    // Fonts are self-hosted from src/public/fonts (see scripts/fetch-fonts.mjs);
    // only the above-the-fold Latin faces are preloaded, never the lazily
    // matched CJK subsets. Both Outfit weights share one variable-font file.
    [
      'link',
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        href: '/fonts/outfit/latin.woff2',
        crossorigin: ''
      }
    ],
    [
      'link',
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        href: '/fonts/jetbrains-mono/latin.woff2',
        crossorigin: ''
      }
    ],
    ['meta', { property: 'og:site_name', content: 'Formulon' }],
    ['meta', { property: 'og:type', content: 'website' }]
  ],

  transformHead({ pageData, description }) {
    const lang = localeOf(pageData.relativePath)
    const seo = SEO[lang]
    const url = `${siteUrl}${routeOf(pageData.relativePath)}`
    const altLang: Locale = lang === 'ja' ? 'en' : 'ja'
    const altUrl = `${siteUrl}${alternateRoute(pageData.relativePath)}`
    const title = pageData.frontmatter.title || seo.title
    const desc = description || seo.description

    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { name: 'keywords', content: seo.keywords }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: desc }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:locale', content: lang }],
      ['meta', { property: 'og:locale:alternate', content: altLang }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: desc }],
      ['link', { rel: 'alternate', hreflang: lang, href: url }],
      ['link', { rel: 'alternate', hreflang: altLang, href: altUrl }],
      [
        'link',
        {
          rel: 'alternate',
          hreflang: 'x-default',
          href: `${siteUrl}${routeOf(pageData.relativePath.replace(/^ja\//, ''))}`
        }
      ],
      ['script', { type: 'application/ld+json' }, JSON.stringify(softwareApplicationJsonLd(lang))]
    ]
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        search: {
          provider: 'local',
          options: {
            locales: {
              root: {
                translations: {
                  button: { buttonText: 'Search', buttonAriaLabel: 'Search docs' },
                  modal: {
                    noResultsText: 'No results for',
                    resetButtonTitle: 'Reset search',
                    footer: {
                      selectText: 'to select',
                      navigateText: 'to navigate',
                      closeText: 'to close'
                    }
                  }
                }
              }
            }
          }
        },
        nav: [
          { text: 'Start', link: '/start/' },
          {
            text: 'Guide',
            items: [
              { text: 'Use cases', link: '/scenarios/' },
              { text: 'Workbook', link: '/workbook/' },
              { text: 'Runtimes', link: '/runtimes/' },
              { text: 'Compatibility', link: '/compatibility/' }
            ]
          },
          {
            text: 'Products',
            items: [
              { text: 'formulon-cell', link: '/cell/' },
              { text: 'MCP server', link: '/mcp/' }
            ]
          },
          { text: 'Development', link: '/development/' },
          { text: 'FAQ', link: '/faq' },
          { text: docsVersionTag, items: [{ text: 'Changelog', link: changelogUrl }] }
        ],
        sidebar: {
          '/start/': startSidebar,
          '/scenarios/': useCasesSidebar,
          '/runtimes/': runtimesSidebar,
          '/api/': runtimesSidebar,
          '/workbook/': workbookSidebar,
          '/mcp/': mcpSidebar,
          '/cell/': cellSidebar,
          '/compatibility/': compatibilitySidebar,
          '/compatibility/formula-coverage': startSidebar,
          '/development/': developmentSidebar,
          '/why': startSidebar,
          '/faq': startSidebar
        },
        socialLinks: [{ icon: 'github', link: githubUrl }],
        footer: {
          message:
            'a personal project by <a href="https://libraz.net" target="_blank" rel="noopener">libraz</a>'
        }
      }
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      description:
        'WebAssembly、Python、CLI、ネイティブ用途に組み込めるヘッドレスな Excel 互換計算エンジン。',
      themeConfig: {
        search: {
          provider: 'local',
          options: {
            locales: {
              ja: {
                translations: {
                  button: { buttonText: '検索', buttonAriaLabel: 'ドキュメント内検索' },
                  modal: {
                    noResultsText: '一致する結果がありません',
                    resetButtonTitle: '検索をリセット',
                    footer: {
                      selectText: '選択',
                      navigateText: '移動',
                      closeText: '閉じる'
                    }
                  }
                }
              }
            }
          }
        },
        nav: [
          { text: 'はじめる', link: '/ja/start/' },
          {
            text: 'ガイド',
            items: [
              { text: '利用例', link: '/ja/scenarios/' },
              { text: 'ワークブック', link: '/ja/workbook/' },
              { text: '実行環境', link: '/ja/runtimes/' },
              { text: '互換性', link: '/ja/compatibility/' }
            ]
          },
          {
            text: 'プロダクト',
            items: [
              { text: 'formulon-cell', link: '/ja/cell/' },
              { text: 'MCP サーバー', link: '/ja/mcp/' }
            ]
          },
          { text: '開発', link: '/ja/development/' },
          { text: 'FAQ', link: '/ja/faq' },
          { text: docsVersionTag, items: [{ text: 'Changelog', link: changelogUrl }] }
        ],
        sidebar: {
          '/ja/start/': jaStartSidebar,
          '/ja/scenarios/': jaUseCasesSidebar,
          '/ja/runtimes/': jaRuntimesSidebar,
          '/ja/api/': jaRuntimesSidebar,
          '/ja/workbook/': jaWorkbookSidebar,
          '/ja/mcp/': jaMcpSidebar,
          '/ja/cell/': jaCellSidebar,
          '/ja/compatibility/': jaCompatibilitySidebar,
          '/ja/compatibility/formula-coverage': jaStartSidebar,
          '/ja/development/': jaDevelopmentSidebar,
          '/ja/why': jaStartSidebar,
          '/ja/faq': jaStartSidebar
        },
        socialLinks: [{ icon: 'github', link: githubUrl }],
        footer: {
          message:
            'a personal project by <a href="https://libraz.net" target="_blank" rel="noopener">libraz</a>'
        }
      }
    }
  }
})
