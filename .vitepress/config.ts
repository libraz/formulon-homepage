import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitepress'

const siteUrl = 'https://formulon.libraz.net'
const githubUrl = 'https://github.com/libraz/formulon'
const docsVersion = '0.9.4'
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

const patchFormulonWorkerOptions = () => {
  const files = [
    resolve(process.cwd(), 'node_modules/@libraz/formulon/dist/formulon.js'),
    resolve(
      process.cwd(),
      'node_modules/@libraz/formulon-cell/node_modules/@libraz/formulon/dist/formulon.js'
    )
  ]

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

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Formulon',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Linux, macOS, Windows, WebAssembly',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    'Headless Excel-compatible calculation engine with a C++17 core, exposed through WebAssembly, Native Node, Python, and CLI surfaces.',
  url: siteUrl,
  downloadUrl: githubUrl,
  softwareVersion: docsVersion,
  author: { '@type': 'Person', name: 'libraz' },
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  keywords:
    'Excel, spreadsheet, formula engine, calculation engine, XLSX, XLSB, WebAssembly, Python, C++17'
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

  vite: {
    plugins: [
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

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
      }
    ],
    ['script', { type: 'application/ld+json' }, JSON.stringify(softwareApplicationJsonLd)],
    [
      'meta',
      {
        name: 'keywords',
        content:
          'Excel, spreadsheet, formula engine, calculation engine, XLSX, XLSB, WebAssembly, Python, C++17'
      }
    ],
    ['link', { rel: 'canonical', href: siteUrl }],
    ['meta', { property: 'og:site_name', content: 'Formulon' }],
    ['meta', { property: 'og:title', content: 'Formulon - Excel-compatible calculation engine' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'A headless C++17 spreadsheet calculation engine packaged for WebAssembly, Native Node, Python, and CLI workflows.'
      }
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: siteUrl }]
  ],

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
          { text: 'MCP', link: '/mcp/' },
          {
            text: 'formulon-cell',
            items: [
              { text: 'What it is', link: '/cell/' },
              { text: 'Full demo', link: '/cell/demo' }
            ]
          },
          { text: 'Use cases', link: '/scenarios/' },
          { text: 'Workbook', link: '/workbook/' },
          { text: 'Runtimes', link: '/runtimes/' },
          { text: 'Compatibility', link: '/compatibility/' },
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
          '/development/': developmentSidebar,
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
          { text: 'MCP', link: '/ja/mcp/' },
          {
            text: 'formulon-cell',
            items: [
              { text: '位置づけ', link: '/ja/cell/' },
              { text: 'フルデモ', link: '/ja/cell/demo' }
            ]
          },
          { text: '利用例', link: '/ja/scenarios/' },
          { text: 'ワークブック', link: '/ja/workbook/' },
          { text: '実行環境', link: '/ja/runtimes/' },
          { text: '互換性', link: '/ja/compatibility/' },
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
          '/ja/development/': jaDevelopmentSidebar,
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
