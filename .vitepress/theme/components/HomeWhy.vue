<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

type Reason = { key: string; title: string; body: string; link: string }

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const copy = computed(() =>
  isJa.value
    ? {
        section: 'Why Formulon',
        heading: 'Excel を動かさずに、Excel の答えを得る',
        body: 'デスクトップアプリの自動操作もホスト型サービスへの送信もせずに、ワークブックを自分のプロセスの中で計算します。どこまで Excel と一致するかは、実測値と照合して公開しています。',
        more: { text: 'Excel 本体やほかの手段との違い', link: '/ja/why#ほかの選択肢との違い' },
        reasons: [
          {
            key: 'Oracle',
            title: '実際の Excel と照合',
            body: 'Excel 365 から取得した値と比べ、既知の差分は理由と確認ビルドつきで記録しています。',
            link: '/ja/compatibility/edge-cases'
          },
          {
            key: 'Locale',
            title: '28 のロケールプロファイル',
            body: 'Mac と Windows の 14 ロケールで、文字列の比較や数式名をその Excel に合わせます。',
            link: '/ja/compatibility/locale-profiles'
          },
          {
            key: 'Local',
            title: 'データは手元から出ない',
            body: '計算はローカルで完結します。ブラウザでは、アップロードしたファイルを端末の外に出しません。',
            link: '/ja/scenarios/browser-upload'
          },
          {
            key: 'One core',
            title: 'どの実行環境でも同じ値',
            body: 'WASM、Python、Native Node、CLI、MCP が同じ C++17 コアを呼びます。',
            link: '/ja/start/choose-runtime'
          },
          {
            key: 'Round trip',
            title: '読み込みから保存まで',
            body: '.xlsx / .xlsb を開き、編集して再計算し、ワークブックとして書き戻せます。',
            link: '/ja/workbook/lifecycle'
          },
          {
            key: 'Coverage',
            title: '511 / 526 関数をローカル実行',
            body: '残る 15 件は Microsoft 365 のサービス依存で、固定のエラーを返します。',
            link: '/ja/compatibility/formula-coverage'
          }
        ] as Reason[]
      }
    : {
        section: 'Why Formulon',
        heading: "Excel's answers, without running Excel.",
        body: 'Workbooks are calculated inside your own process, with no desktop app to automate and no hosted service to send files to. How closely the results match Excel is measured and published.',
        more: {
          text: 'Compare with Excel, office suites, formula libraries, and cloud APIs',
          link: '/why#compared-with-the-alternatives'
        },
        reasons: [
          {
            key: 'Oracle',
            title: 'Checked against real Excel',
            body: 'Results are compared with values captured from Excel 365; each known difference is recorded with its reason and build.',
            link: '/compatibility/edge-cases'
          },
          {
            key: 'Locale',
            title: '28 locale profiles',
            body: 'Fourteen locales on Mac and Windows, so text comparison and formula names follow the Excel you target.',
            link: '/compatibility/locale-profiles'
          },
          {
            key: 'Local',
            title: 'Data stays with you',
            body: 'Calculation is local. In a browser, an uploaded workbook never has to leave the device.',
            link: '/scenarios/browser-upload'
          },
          {
            key: 'One core',
            title: 'Same value on every runtime',
            body: 'WASM, Python, Native Node, CLI, and MCP all call the same C++17 core.',
            link: '/start/choose-runtime'
          },
          {
            key: 'Round trip',
            title: 'Load to save, not just formulas',
            body: 'Open .xlsx or .xlsb, edit, recalculate, and write the workbook back.',
            link: '/workbook/lifecycle'
          },
          {
            key: 'Coverage',
            title: '511 of 526 functions run locally',
            body: 'The other 15 depend on Microsoft 365 services and return a fixed error.',
            link: '/compatibility/formula-coverage'
          }
        ] as Reason[]
      }
)
</script>

<template>
  <section class="fln-why" aria-labelledby="fln-why-title">
    <div class="fln-why-inner">
      <header class="fln-start-header">
        <span class="fln-section-mark" data-volume="02">{{ copy.section }}</span>
        <h2 id="fln-why-title">{{ copy.heading }}</h2>
        <p>{{ copy.body }}</p>
      </header>
      <div class="fln-why-grid" role="list">
        <a v-for="reason in copy.reasons" :key="reason.key" :href="reason.link" role="listitem">
          <span>{{ reason.key }}</span>
          <strong>{{ reason.title }}</strong>
          <p>{{ reason.body }}</p>
        </a>
      </div>
      <a class="fln-why-more" :href="copy.more.link">{{ copy.more.text }}<span aria-hidden="true">→</span></a>
    </div>
  </section>
</template>
