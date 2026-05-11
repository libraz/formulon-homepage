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
    ? 'Formulon はライブラリ紹介だけでは判断しづらい領域です。最初に「どこでワークブックを扱うか」を選ぶと、必要な実行環境、API、互換性確認に進めます。'
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
            'WASM でファイルアップロード、数式編集、再計算プレビューを処理します。Office 不要のクライアント計算。',
          link: '/ja/scenarios/browser-upload'
        },
        {
          key: 'Backend',
          title: 'Python で一括再計算する',
          description:
            '帳票生成や ETL でスプレッドシートの計算ロジックをサーバー側へ移し、定型業務を自動化します。',
          link: '/ja/scenarios/python-batch'
        },
        {
          key: 'Pipeline',
          title: 'CI でワークブックの回帰を検出する',
          description:
            '基準ワークブックと Excel 由来の期待値で、計算結果のずれを継続的に検出します。',
          link: '/ja/scenarios/ci-regression'
        },
        {
          key: 'Agent',
          title: 'AI エージェントから workbook を編集する',
          description:
            'MCP tools で .xlsx を開き、セル、シート、定義名、レイアウトを操作して再計算します。',
          link: '/ja/mcp/'
        }
      ]
    : [
        {
          key: 'Desk',
          title: 'Upload workbook in a browser',
          description:
            'WASM handles file upload, formula edits, and preview recalculation — client-side, with no Office runtime.',
          link: '/scenarios/browser-upload'
        },
        {
          key: 'Backend',
          title: 'Batch recalculation from Python',
          description:
            'Move spreadsheet logic into report generation, ETL pipelines, and scheduled recalc jobs.',
          link: '/scenarios/python-batch'
        },
        {
          key: 'Pipeline',
          title: 'Workbook regression in CI',
          description:
            'Detect calculation drift continuously with golden workbooks and Excel-derived oracle profiles.',
          link: '/scenarios/ci-regression'
        },
        {
          key: 'Agent',
          title: 'Edit workbooks from an AI agent',
          description:
            'Use MCP tools to open .xlsx files, mutate cells, sheets, names, and layout, then recalculate.',
          link: '/mcp/'
        }
      ]
)

const capabilities = computed<Capability[]>(() =>
  isJa.value
    ? [
        {
          key: 'MCP',
          value: 'AI エージェント向け workbook 操作 tools',
          link: '/ja/mcp/'
        },
        {
          key: 'Runtime',
          value: 'WASM / Python / CLI が 1 つの C++17 core を共有',
          link: '/ja/runtimes/'
        },
        {
          key: 'Use cases',
          value: 'ブラウザアップロード、Python バッチ、CI 回帰検査',
          link: '/ja/scenarios/'
        },
        {
          key: 'Compatibility',
          value: '全関数登録と Excel 由来の期待値',
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
          value: 'WASM, Python, and CLI share one C++17 core',
          link: '/runtimes/'
        },
        {
          key: 'Use cases',
          value: 'Browser upload, Python batch, and CI workbook regression',
          link: '/scenarios/'
        },
        {
          key: 'Compatibility',
          value: 'Full function registration and Excel oracle data',
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
