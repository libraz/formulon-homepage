<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

type Part = { text: string; mono?: boolean }
type Stat = { value: string; label: string }

const copy = computed(() =>
  isJa.value
    ? {
        masthead: 'Formulon',
        volume: '0.9',
        issue: 'v0.9.4 · 2026 / 07',
        eyebrow: 'Workbook calculation platform',
        claimParts: [
          { text: 'Excel ワークブックを ' },
          { text: 'アプリ・自動化・AI エージェント', mono: true },
          { text: ' から扱う計算基盤。' }
        ] as Part[],
        sub: 'Formulon は 1 つの C++17 計算エンジンを WebAssembly、Python、CLI、MCP から使えるようにし、Excel をインストールせずに .xlsx / .xlsb の読み込み、式評価、再計算、書き戻しを扱います。',
        primary: { text: 'クイックスタート', link: '/ja/start/install' },
        secondary: { text: 'MCP で使う', link: '/ja/mcp/' },
        tertiary: { text: '利用シナリオを見る', link: '/ja/scenarios/' },
        demo: { text: 'デモ UI を試す', link: '/ja/cell/demo' },
        stats: [
          { value: 'v0.9.4', label: '最新リリース' },
          { value: '505 / 522', label: 'ローカル実装 / 認識対象' },
          { value: '31', label: 'MCP ツール' }
        ] as Stat[],
        coverageNote:
          '残り 17 件は Copilot、クラウド Python、画像取得、株価取得、CUBE 接続など外部サービス依存です。',
        coverageLink: { text: '理由を見る', link: '/ja/compatibility/formula-coverage' },
        flow: ['読み込み', '再計算', '保存形式へ変換', '出力'],
        sheetTitle: 'quarterly-plan.xlsx',
        stamp: '検証済み',
        cells: [
          ['Region', 'Q1', 'Q2', 'Δ'],
          ['Tokyo', '128', '144', '=C2-B2'],
          ['Osaka', '81', '79', '=C3-B3'],
          ['Total', '=SUM(B2:B3)', '=SUM(C2:C3)', '=C4-B4']
        ],
        result: 'Excel なしで再計算',
        resultMeta: 'validated · local recalc'
      }
    : {
        masthead: 'Formulon',
        volume: '0.9',
        issue: 'v0.9.4 · 2026 / 07',
        eyebrow: 'Headless Spreadsheet Engine',
        claimParts: [
          { text: 'A workbook calculation platform for ' },
          { text: 'apps, automation, and AI agents', mono: true },
          { text: '.' }
        ] as Part[],
        sub: 'Formulon ships one C++17 calculation core across WASM, Python, CLI, and MCP so applications can read, evaluate, recalculate, and write .xlsx / .xlsb files without Excel, Microsoft runtimes, or COM automation.',
        primary: { text: 'Quick Start', link: '/start/install' },
        secondary: { text: 'Use from MCP', link: '/mcp/' },
        tertiary: { text: 'Browse scenarios', link: '/scenarios/' },
        demo: { text: 'Try the demo UI', link: '/cell/demo' },
        stats: [
          { value: 'v0.9.4', label: 'Latest release' },
          { value: '505 / 522', label: 'Local / recognized functions' },
          { value: '31', label: 'MCP tools' }
        ] as Stat[],
        coverageNote:
          'The remaining 17 require external services such as Copilot, cloud Python, image fetch, market data, or CUBE connections.',
        coverageLink: { text: 'See why', link: '/compatibility/formula-coverage' },
        flow: ['parse', 'recalc', 'serialize', 'export'],
        sheetTitle: 'quarterly-plan.xlsx',
        stamp: 'Verified',
        cells: [
          ['Region', 'Q1', 'Q2', 'Δ'],
          ['Tokyo', '128', '144', '=C2-B2'],
          ['Osaka', '81', '79', '=C3-B3'],
          ['Total', '=SUM(B2:B3)', '=SUM(C2:C3)', '=C4-B4']
        ],
        result: 'Recalculated without Excel',
        resultMeta: 'validated · local recalc'
      }
)

const flowLabel = (i: number) => String(i + 1).padStart(2, '0')
</script>

<template>
  <section class="fln-hero" aria-labelledby="fln-wordmark">
    <div class="fln-hero-inner">
      <div class="fln-hero-copy">
        <p class="fln-eyebrow">{{ copy.eyebrow }}</p>
        <h1 id="fln-wordmark" class="fln-wordmark">Formulon</h1>
        <p class="fln-claim">
          <template v-for="(p, j) in copy.claimParts" :key="j"
            ><em v-if="p.mono">{{ p.text }}</em
            ><template v-else>{{ p.text }}</template></template
          >
        </p>
        <p class="fln-sub">{{ copy.sub }}</p>
        <div class="fln-actions">
          <a :href="copy.primary.link" class="fln-cta fln-cta-primary"
            >{{ copy.primary.text }}<span aria-hidden="true">→</span></a
          >
          <a :href="copy.secondary.link" class="fln-cta fln-cta-secondary">{{
            copy.secondary.text
          }}</a>
          <a :href="copy.tertiary.link" class="fln-cta-link">{{ copy.tertiary.text }}</a>
          <a :href="copy.demo.link" class="fln-cta-link">{{ copy.demo.text }}</a>
        </div>
      </div>

      <aside class="fln-workbench" aria-label="Workbook recalculation preview">
        <header class="fln-workbench-bar">
          <span class="fln-marks" aria-hidden="true"
            ><span></span><span></span><span></span
          ></span>
          <strong>{{ copy.sheetTitle }}</strong>
          <span class="fln-stamp">{{ copy.stamp }}</span>
        </header>
        <div class="fln-pipeline" aria-hidden="true">
          <span v-for="(step, i) in copy.flow" :key="step"
            ><b>{{ flowLabel(i) }}</b>{{ step }}</span
          >
        </div>
        <div class="fln-sheet" role="table" aria-label="Spreadsheet sample">
          <div v-for="(row, r) in copy.cells" :key="r" class="fln-sheet-row" role="row">
            <span
              v-for="(cell, c) in row"
              :key="`${r}-${c}`"
              :class="{ formula: cell.startsWith('=') }"
              >{{ cell }}</span
            >
          </div>
        </div>
        <footer class="fln-result">
          <span class="fln-result-mark" aria-hidden="true"></span>
          <span class="fln-result-text">{{ copy.result }}</span>
          <span class="fln-result-meta">{{ copy.resultMeta }}</span>
        </footer>
      </aside>
    </div>

    <dl class="fln-ledger">
      <div v-for="stat in copy.stats" :key="stat.label" class="fln-ledger-row">
        <dt class="fln-ledger-val">{{ stat.value }}</dt>
        <dd class="fln-ledger-key">{{ stat.label }}</dd>
      </div>
    </dl>
    <p class="fln-coverage-note">
      {{ copy.coverageNote }}
      <a :href="copy.coverageLink.link">{{ copy.coverageLink.text }}</a>
    </p>
  </section>
</template>
