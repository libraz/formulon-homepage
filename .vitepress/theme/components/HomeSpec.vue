<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

type Path = { key: string; title: string; description: string; link: string }
type Capability = { key: string; value: string; link: string }

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const heading = computed(() => (isJa.value ? '用途から始める' : 'Start from the job.'))
const subheading = computed(() =>
  isJa.value
    ? 'ワークブックをどこで扱うかに応じて、実行環境を選んでください。各ガイドで、必要な API と互換性の確認方法を説明します。'
    : 'Formulon is easiest to evaluate from the place where the workbook runs. Pick the deployment first, then move into the runtime, API, and compatibility details that matter for that path.'
)
const sectionLabel = computed(() => (isJa.value ? 'Operations' : 'Operations'))

const paths = computed<Path[]>(() =>
  isJa.value
    ? [
        {
          key: 'Desk',
          title: 'ブラウザでワークブックを開く',
          description:
            'WASM でファイルの読み込み、数式編集、再計算を処理します。Office を使わず、ブラウザ内で計算できます。',
          link: '/ja/scenarios/browser-upload'
        },
        {
          key: 'Backend',
          title: 'Node サービスで再計算する',
          description:
            'アップロード API や社内サービスで .xlsx を受け取り、Native Node または WASM で再計算して返します。',
          link: '/ja/scenarios/node-service'
        },
        {
          key: 'Batch',
          title: 'Python で一括再計算する',
          description: '帳票生成や ETL、定期実行の処理でワークブックを一括再計算します。',
          link: '/ja/scenarios/python-batch'
        },
        {
          key: 'Pipeline',
          title: 'CI で計算結果の変化を検出する',
          description:
            'コミット済みの数式・値のスナップショットと比較し、計算結果の変化を検出します。',
          link: '/ja/scenarios/ci-regression'
        },
        {
          key: 'Agent',
          title: 'AI エージェントからワークブックを編集する',
          description:
            'MCP ツールで .xlsx / .xlsb を開き、セル、シート、定義名、レイアウトを操作して再計算します。',
          link: '/ja/mcp/'
        }
      ]
    : [
        {
          key: 'Desk',
          title: 'Upload workbook in a browser',
          description:
            'WASM loads workbook files, edits formulas, and recalculates in the browser without an Office runtime.',
          link: '/scenarios/browser-upload'
        },
        {
          key: 'Backend',
          title: 'Recalculate inside a Node service',
          description:
            'Accept .xlsx files in an upload API or internal service, then recalculate with Native Node or WASM.',
          link: '/scenarios/node-service'
        },
        {
          key: 'Batch',
          title: 'Batch recalculation from Python',
          description:
            'Recalculate workbooks in report generation, ETL pipelines, and scheduled jobs.',
          link: '/scenarios/python-batch'
        },
        {
          key: 'Pipeline',
          title: 'Workbook regression in CI',
          description:
            'Detect calculation changes by comparing checked-in formula and value snapshots.',
          link: '/scenarios/ci-regression'
        },
        {
          key: 'Agent',
          title: 'Edit workbooks from an AI agent',
          description:
            'Use MCP tools to open .xlsx or .xlsb files, mutate cells, sheets, names, and layout, then recalculate.',
          link: '/mcp/'
        }
      ]
)

const capabilities = computed<Capability[]>(() =>
  isJa.value
    ? [
        {
          key: 'MCP',
          value: 'AI エージェント向けのワークブック操作ツール',
          link: '/ja/mcp/'
        },
        {
          key: 'Runtime',
          value: 'WASM / Python / Native Node / CLI が同じ C++17 エンジンを使用',
          link: '/ja/runtimes/'
        },
        {
          key: 'Use cases',
          value: 'ブラウザアップロード、Python バッチ、CI 回帰検査',
          link: '/ja/scenarios/'
        },
        {
          key: 'Compatibility',
          value: '関数の対応状況と Excel 由来の期待値',
          link: '/ja/compatibility/'
        }
      ]
    : [
        {
          key: 'MCP',
          value: 'Workbook operation tools for AI agents',
          link: '/mcp/'
        },
        {
          key: 'Runtime',
          value: 'WASM, Python, Native Node, and CLI share one C++17 core',
          link: '/runtimes/'
        },
        {
          key: 'Use cases',
          value: 'Browser upload, Python batch, and CI workbook regression',
          link: '/scenarios/'
        },
        {
          key: 'Compatibility',
          value: 'Function availability and Excel oracle data',
          link: '/compatibility/'
        }
      ]
)
</script>

<template>
  <section class="fln-start" :aria-label="heading">
    <div class="fln-start-inner">
      <header class="fln-start-header">
        <span class="fln-section-mark" data-volume="03">{{ sectionLabel }}</span>
        <h2>{{ heading }}</h2>
        <p>{{ subheading }}</p>
      </header>
      <div class="fln-path-grid" role="list">
        <a v-for="path in paths" :key="path.key" :href="path.link" class="fln-path" role="listitem">
          <span class="fln-path-key">{{ path.key }}</span>
          <strong>{{ path.title }}</strong>
          <span class="fln-path-desc">{{ path.description }}</span>
        </a>
      </div>
      <div class="fln-capabilities" role="list">
        <a v-for="cap in capabilities" :key="cap.key" :href="cap.link" role="listitem">
          <span>{{ cap.key }}</span>
          <strong>{{ cap.value }}</strong>
        </a>
      </div>
    </div>
  </section>
</template>
