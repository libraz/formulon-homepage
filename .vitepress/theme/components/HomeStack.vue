<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

type Cell = {
  name: string
  meta: string
  children?: string[]
  link?: string
}

type Layer = {
  kind: 'pair' | 'triple' | 'single' | 'tags'
  mark: string
  caption: string
  cells?: Cell[]
  cell?: Cell
  items?: string[]
}

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const copy = computed(() =>
  isJa.value
    ? {
        section: 'Ecosystem',
        heading: 'パッケージ構成と関係性',
        body: 'L1 が C++17 計算エンジン、L2 が言語ごとのインターフェイスパッケージ、L3 が用途別アプリパッケージ、L4 が利用側のアプリやエージェントです。',
        layers: <Layer[]>[
          {
            kind: 'pair',
            mark: 'L4',
            caption: '利用側',
            cells: [
              { name: 'AI エージェント', meta: 'Claude Code · Codex · Claude Desktop' },
              { name: 'ブラウザアプリ', meta: 'React / Vue / 素のフロントエンド' }
            ]
          },
          {
            kind: 'pair',
            mark: 'L3',
            caption: 'アプリ向けパッケージ',
            cells: [
              {
                name: '@libraz/formulon-mcp',
                meta: 'stdio MCP サーバー · 31 ツール',
                link: '/ja/mcp/'
              },
              {
                name: '@libraz/formulon-cell',
                meta: 'フレームワーク非依存のスプレッドシート UI',
                children: ['@libraz/formulon-cell-react', '@libraz/formulon-cell-vue'],
                link: '/ja/cell/'
              }
            ]
          },
          {
            kind: 'triple',
            mark: 'L2',
            caption: '言語インターフェイス',
            cells: [
              {
                name: '@libraz/formulon',
                meta: 'npm · ブラウザ / Node 向け WASM バインディング',
                link: '/ja/runtimes/wasm'
              },
              {
                name: 'formulon',
                meta: 'PyPI · Python スクリプトおよびバッチ',
                link: '/ja/runtimes/python'
              },
              {
                name: 'formulon (CLI)',
                meta: 'GitHub Releases バイナリ · CI / シェル',
                link: '/ja/runtimes/cli'
              }
            ]
          },
          {
            kind: 'single',
            mark: 'L1',
            caption: '計算エンジン',
            cell: {
              name: 'formulon',
              meta: 'C++17 · Excel 由来の期待値で検証 (github.com/libraz/formulon)',
              link: '/ja/development/architecture'
            }
          }
        ]
      }
    : {
        section: 'Ecosystem',
        heading: 'How the packages relate',
        body: 'L1 is the C++17 calculation core (formulon). L2 is per-language interface packages — @libraz/formulon on npm, formulon on PyPI, plus the CLI binary. L3 is app-facing packages. L4 is the consumer.',
        layers: <Layer[]>[
          {
            kind: 'pair',
            mark: 'L4',
            caption: 'Consumer',
            cells: [
              { name: 'AI agents', meta: 'Claude Code · Codex · Claude Desktop' },
              { name: 'Browser apps', meta: 'React / Vue / vanilla frontends' }
            ]
          },
          {
            kind: 'pair',
            mark: 'L3',
            caption: 'App-facing package',
            cells: [
              {
                name: '@libraz/formulon-mcp',
                meta: 'stdio MCP server · 31 tools',
                link: '/mcp/'
              },
              {
                name: '@libraz/formulon-cell',
                meta: 'framework-free spreadsheet UI host',
                children: ['@libraz/formulon-cell-react', '@libraz/formulon-cell-vue'],
                link: '/cell/'
              }
            ]
          },
          {
            kind: 'triple',
            mark: 'L2',
            caption: 'Language interface',
            cells: [
              {
                name: '@libraz/formulon',
                meta: 'npm · WASM binding for browser and Node',
                link: '/runtimes/wasm'
              },
              {
                name: 'formulon',
                meta: 'PyPI · Python scripts and batch jobs',
                link: '/runtimes/python'
              },
              {
                name: 'formulon (CLI)',
                meta: 'GitHub Releases binary · CI and shell',
                link: '/runtimes/cli'
              }
            ]
          },
          {
            kind: 'single',
            mark: 'L1',
            caption: 'Calculation core',
            cell: {
              name: 'formulon',
              meta: 'C++17 calculation core · Excel-derived oracle data (github.com/libraz/formulon)',
              link: '/development/architecture'
            }
          }
        ]
      }
)
</script>

<template>
  <section class="fln-stack" aria-labelledby="fln-stack-title">
    <div class="fln-stack-inner">
      <header class="fln-stack-header">
        <span class="fln-section-mark" data-volume="02">{{ copy.section }}</span>
        <h2 id="fln-stack-title">{{ copy.heading }}</h2>
        <p>{{ copy.body }}</p>
      </header>

      <div class="fln-stack-grid" role="list">
        <div
          v-for="layer in copy.layers"
          :key="layer.mark"
          class="fln-stack-row"
          :data-kind="layer.kind"
          role="listitem"
        >
          <div class="fln-stack-caption">
            <span class="fln-stack-mark">{{ layer.mark }}</span>
            <strong>{{ layer.caption }}</strong>
          </div>

          <div class="fln-stack-body" :data-kind="layer.kind">
            <template v-if="layer.kind === 'pair' && layer.cells">
              <component
                :is="cell.link ? 'a' : 'div'"
                v-for="(cell, i) in layer.cells"
                :key="i"
                :href="cell.link"
                class="fln-stack-cell"
              >
                <strong>{{ cell.name }}</strong>
                <span>{{ cell.meta }}</span>
                <ul v-if="cell.children">
                  <li v-for="child in cell.children" :key="child">{{ child }}</li>
                </ul>
              </component>
            </template>

            <template v-else-if="layer.kind === 'triple' && layer.cells">
              <component
                :is="cell.link ? 'a' : 'div'"
                v-for="(cell, i) in layer.cells"
                :key="i"
                :href="cell.link"
                class="fln-stack-chip"
              >
                <strong>{{ cell.name }}</strong>
                <span>{{ cell.meta }}</span>
              </component>
            </template>

            <component
              v-else-if="layer.kind === 'single' && layer.cell"
              :is="layer.cell.link ? 'a' : 'div'"
              :href="layer.cell.link"
              class="fln-stack-cell fln-stack-cell-wide"
            >
              <strong>{{ layer.cell.name }}</strong>
              <span>{{ layer.cell.meta }}</span>
            </component>

            <template v-else-if="layer.kind === 'tags' && layer.items">
              <span v-for="item in layer.items" :key="item" class="fln-stack-tag">{{ item }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
