---
title: formulon-cell の埋め込み
description: formulon-cell 参考 UI のプリセット、拡張、コマンドヘルパーを組み合わせる方法。
---

# 埋め込みガイド

`formulon-cell` は参考 UI ライブラリなので、部品を再利用できるように分けています。同梱のプレイグラウンドは `presets.full()` を選んでいますが、実際に取り入れる場合は小さいプリセットから始め、必要な機能だけを足す形が基本です。

デフォルト chrome を Excel 互換の完成アプリケーション shell として扱わないでください。結合試験と実装例には有用ですが、本番プロダクトでは機能範囲、UX、品質基準を個別に決める必要があります。

::: info 用語: プリセットと拡張
*プリセット* は機能のまとまり、*拡張* は 1 個の合成可能な機能ファクトリです。`presets.full()` は実体としては長い拡張配列を返しているだけなので、同じ配列を自分で組み立てることもできます。
:::

## 3 つのホスト形

<DiagramLayers :layers="[
  { nodes: ['ホストアプリ'] },
  { nodes: ['Spreadsheet.mount(host, options)'] },
  { title: 'mount() が組み立てるもの', nodes: [
    { label: 'WorkbookHandle', note: 'WASM エンジン、preferStub: true のときは簡易エンジン' },
    { label: 'features + extensions', note: 'chrome ─ ダイアログ、ツールバー、パネル' },
    { label: 'store（zustand）', note: '選択範囲、undo、セルデータ' }
  ] },
  { nodes: [{ label: 'ホストコード', note: 'instance.store.getState() を読み、コマンドヘルパーを呼び、イベントを購読' }] }
]" label="ホストアプリが Spreadsheet をマウントすると WorkbookHandle・features/extensions・store が組み立てられ、ホストコードはそのストアを直接読み書きする" />

1. **ドロップイン**。プリセットをそのまま使い、i18n とテーマでカスタマイズ。
2. **混在 UI**。`presets.minimal()` をベースに、必要なダイアログ / ツールバーだけ拡張で追加。
3. **ヘッドレス UI**。組み込み UI なしで canvas だけマウントし、アプリ側のツールバーから [コマンドヘルパー](#コマンドヘルパー) で駆動。

## ドロップインマウント

```ts
import { Spreadsheet, WorkbookHandle, presets } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'
import '@libraz/formulon-cell/styles/paper.css'

const host = document.getElementById('sheet')!
const workbook = await WorkbookHandle.createDefault()

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: presets.full(),
  locale: 'ja',
  theme: 'paper'
})
```

## 選択的な拡張

`MountOptions` には機能構成のための独立した 2 つのオプションがあります。

- **`features: FeatureFlags`** ─ 組み込み機能を on/off するブール値のプレーンオブジェクト（例: `{ findReplace: false }`）。`presets.minimal()` / `presets.standard()` / `presets.full()` はいずれもこのオブジェクトを返します ─ 配列ではないので、配列に spread してはいけません。
- **`extensions: ExtensionInput[]`** ─ 引数を取らないファクトリ関数（呼ぶと `Extension` を返す）の配列。既定の chrome と並べて、あるいは対応する組み込み機能を無効化したうえでその代わりにマウントします。

<DiagramLayers :layers="[
  { nodes: ['MountOptions'] },
  { nodes: [
    { label: 'features: FeatureFlags', note: '{ findReplace: false } ─ オブジェクト、組み込み機能の on/off' },
    { label: 'extensions: ExtensionInput[]', note: '[findReplace(), formatDialog()] ─ ファクトリの配列' }
  ] }
]" label="MountOptions.features はブール値のフラグオブジェクト、MountOptions.extensions は引数なしの拡張ファクトリを集めた別の配列" />

置換可能なファクトリは同じ export にあります ─ `extensions/index.ts` で確認済みで、**引数なし**で呼び出します。

```ts
import {
  Spreadsheet,
  presets,
  findReplace,
  formatDialog,
  namedRangeDialog,
  hyperlinkDialog,
  pivotTableDialog,
  validationList,
  hoverComment,
  viewToolbar,
  quickAnalysis
} from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  // 置き換えたい／外したい組み込み機能を無効化し...
  features: { ...presets.minimal(), findReplace: false },
  // ...`extensions` で自分の選んだものをマウントする
  extensions: [findReplace(), formatDialog(), namedRangeDialog()]
})
```

`autocomplete` に対応する拡張ファクトリはありません ─ `features` のフラグのみです（`features: { autocomplete: false }` で無効化。置き換え先はありません）。

`extensions` 配列内の順序が有効化順です。多くの拡張は独立していますが、`pasteSpecial` のようにクリップボード用コマンドヘルパーと協調するものがあります。迷ったら内部で `allBuiltIns` がマウントする順序を確認してください。

## ヘッドレスマウント

```ts
const headless = await Spreadsheet.mount(host, {
  workbook,
  features: presets.minimal(),
  locale: 'ja'
})

// エンジンが把握している状態を読む
const state = headless.store.getState()
const active = state.selection.active
```

そこからはコマンドヘルパーでアプリ側のツールバーから駆動します。詳しくは [コマンドヘルパー](#コマンドヘルパー) を参照してください。

## コマンドヘルパー

このパッケージは、組み込み UI と拡張が内部で使っているのと同じフラットなエンジン連携コマンド関数を export しています。これらは store オブジェクト自体ではなく `State` のスナップショット（`instance.store.getState()`）に対して動作します。`clipboardCommands` / `formattingCommands` のようなグループ化された名前空間は存在しません ─ 必要な関数を個別に import してください。

```ts
import { copy, cut, pasteTSV, applyPasteSpecial, toggleBold, setNumFmt, addConditionalRule, listComments } from '@libraz/formulon-cell'

const state = instance.store.getState()

copy(state)                                    // クリップボード
toggleBold(state, instance.store)               // 書式（store も取るヘルパーがある）
setNumFmt(state, instance.store, '#,##0.00')
listComments(state)                             // 読み取り専用ヘルパーは state だけを取る
addConditionalRule(instance.store, {             // ルール / history 系の一部は store を直接取る
  kind: 'cell-value',
  range: { sheet: 0, r0: 1, c0: 1, r1: 10, c1: 1 },
  op: '>',
  a: 100,
  apply: { fill: '#ffe4e4' }
})
```

全リストは `@libraz/formulon-cell` の `index.ts` の re-export を確認してください ─ クリップボード（`copy`/`cut`/`pasteTSV`/`applyPasteSpecial`）、書式（`toggleBold`/`setNumFmt`/`setFont`/…）、定義名（`listDefinedNames`/`upsertDefinedName`/…）、コメント（`setComment`/`listComments`/…）、ハイパーリンク（`setHyperlink`/`listHyperlinks`/…）、条件付き書式（`addConditionalRule`/`listConditionalRules`/…）、ステータスバー向けの選択範囲集計（`aggregateSelection`/`visibleStatusAggregates`）など。

::: tip 同じコードパスが組み込み UI でも走る
組み込みのツールバーがやることと、コマンドヘルパーがやることは同じ実装です。undo エントリも、再計算の挙動も、イベント発火タイミングも変わりません。
:::

## リボンツールバー

既定の chrome のリボンは、グリッドとは別にマウントするものです ─ core では `Spreadsheet.mountToolbar(host, instance, opts)` です。`<Spreadsheet>` だけ（あるいは `Spreadsheet.mount()` を直接呼ぶだけ）だとリボンの無いグリッドしか手に入りません ─ ツールバーは明示的に並べてマウントしてください。

```vue
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Spreadsheet as CoreSpreadsheet, type RibbonTab, type SpreadsheetInstance, type ToolbarInstance } from '@libraz/formulon-cell'
import { Spreadsheet } from '@libraz/formulon-cell-vue'

const instance = ref<SpreadsheetInstance | null>(null)
const activeTab = ref<RibbonTab>('home')
const toolbarHost = ref<HTMLDivElement | null>(null)
let toolbar: ToolbarInstance | null = null

watch(instance, async (next) => {
  await nextTick()
  if (!next || !toolbarHost.value) return
  toolbar?.dispose()
  toolbar = CoreSpreadsheet.mountToolbar(toolbarHost.value, next, {
    lang: 'ja',
    activeTab: activeTab.value,
    onTabChange: (tab) => (activeTab.value = tab)
  })
})
</script>

<template>
  <div ref="toolbarHost"></div>
  <Spreadsheet locale="ja" @ready="(inst) => (instance = inst)" />
</template>
```

リボンの DOM、メニューファクトリ、activation モデル、dropdown ディスパッチャはすべて `@libraz/formulon-cell` 本体にあります。framework wrapper とホスト側で組んだ toolbar は、同じ command path を使います。

## ライフサイクルフック

マウントは `dispose()` を持つ `SpreadsheetInstance` を返します。インスタンスを作れなかった場合（多くは WASM エンジンが起動できないとき ─ [簡易エンジン](/ja/cell/index#sharedarraybuffer-が無いと-reject-する) 参照）、`Spreadsheet.mount()` は **reject します**。try/catch で包むか、`MountOptions.onError` を渡してください。

```ts
useEffect(() => {
  let instance: SpreadsheetInstance | undefined
  ;(async () => {
    try {
      instance = await Spreadsheet.mount(host, {
        workbook,
        features: presets.minimal(),
        onError: (err) => showConfigurationError(err),
      })
    } catch (err) {
      // onError は既に実行済み。これは onError を渡し忘れた呼び出し側のための保険
      showConfigurationError(err)
    }
  })()
  return () => instance?.dispose()
}, [])
```

`dispose()` はリスナを外し、DOM をアンマウントし、組み込み UI が保持していたエンジン参照を解放します。`WorkbookHandle` の所有権は呼び出し側にあり、アプリ終了時に `wb.dispose()` で解放してください。React / Vue アダプタも、同じ失敗を `onError` プロパティ / `error` イベントと、フレームワークネイティブな代替 UI を描画する `errorFallback` プロパティとして公開しています。

## 簡易エンジンの検出

`preferStub: true` は、インメモリの簡易エンジンを使うための明示的なオプトインです ─ テストとデモ専用で、本番の暗黙フォールバックとして使うことはありません。

```ts
import { WorkbookHandle } from '@libraz/formulon-cell'

const wb = await WorkbookHandle.createDefault({ preferStub: true })
if (wb.isStub) {
  showBanner('簡易エンジンで動作しています ─ 評価できる数式はごく一部で、保存はできません。')
}
```

`wb.isStub`（およびモジュール単位の `isUsingStub()`）は簡易エンジンが使われているかどうかを反映します。ワークブック生成後に途中で変わることはありません。`preferStub` を指定しない場合、`SharedArrayBuffer` が無ければ `createDefault()` は代わりに reject します ─ COOP/COEP の要件は [バンドラ設定](/ja/cell/bundler) を参照してください。

## React adapter

```tsx
import { Spreadsheet, presets } from '@libraz/formulon-cell-react'

export function Sheet() {
  return (
    <Spreadsheet
      features={presets.standard()}
      locale="ja"
      theme="paper"
      onSelectionChange={(event) => console.log(event.active)}
    />
  )
}
```

アダプタがマウント / dispose を担当し、イベントを prop で転送します。reject したマウントをハンドリングするには `onError` や `errorFallback` を渡してください（[ライフサイクルフック](#ライフサイクルフック) 参照）。渡さないと未処理の rejection として表面化します。より細かい制御が必要なら vanilla パッケージを直接使ってください。

## Vue adapter

```vue
<script setup lang="ts">
import { Spreadsheet, presets } from '@libraz/formulon-cell-vue'
</script>

<template>
  <Spreadsheet
    :features="presets.standard()"
    locale="ja"
    theme="paper"
    @selection-change="(event) => console.log(event.active)"
    @error="(err) => showConfigurationError(err)"
  />
</template>
```

## 次に読むもの

- [i18n](/ja/cell/i18n) ─ ロケール登録と上書き
- [API 一覧](/ja/cell/api) ─ events / store / command
- [バンドラ設定](/ja/cell/bundler) ─ ホストに必要な配信設定
