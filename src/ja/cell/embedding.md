---
title: formulon-cell の埋め込み
description: formulon-cell 参考 UI のプリセット、拡張、コマンドヘルパーを組み合わせる方法。
---

# 埋め込みガイド

`formulon-cell` は参考 UI ライブラリなので、部品を再利用できるように分けています。同梱のプレイグラウンドは `presets.full()` を選んでいますが、実際に取り入れる場合は小さいプリセットから始め、必要な機能だけを足す形が基本です。

デフォルト chrome を Excel 互換の完成アプリケーション shell として扱わないでください。結合試験と実装例には有用ですが、本番プロダクトでは機能範囲、UX、品質基準を個別に決める必要があります。

::: info 用語: プリセットと拡張
*プリセット* は機能のまとまり、*拡張* は 1 個の合成可能な機能ファクトリです。`presets.minimal()` / `presets.standard()` / `presets.full()` はいずれもプレーンな `FeatureFlags` オブジェクトを返します ─ 拡張の配列ではありません。同等のフラグ構成を自分で組み立てることもできます。
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

リボンを追加する最短の方法は、`Spreadsheet.mount` の `toolbar` オプションです。1 回の呼び出しでリボンをホスト内部に組み立て（別途 toolbar ホストを配線する必要なし）、リボンはグリッドの `data-fc-theme` を共有するため、`setTheme()` 一発で両面が再テーマされます。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: presets.full(),
  toolbar: true, // または MountToolbarOptions オブジェクト
})
// instance.toolbar が ToolbarInstance（toolbar を要求しない場合は null）
```

`true` の代わりに `MountToolbarOptions` オブジェクトを渡すと、backstage コンテンツ（`createBackstageView`）、hooks、サブメニューファクトリ、ribbon タブプロファイル、ライフサイクルコールバック（`onTabChange` など）を、単一呼び出しのまま追加できます ─ 指定したフィールドは組み込み既定にマージされます。`instance.dispose()` は toolbar もまとめて破棄します。

React / Vue では、framework パッケージ同梱の `SpreadsheetToolbar` コンポーネントが同じリボンをラップします ─ core の薄いアダプタで、リボンの DOM、メニューファクトリ、activation モデル、dropdown ディスパッチャを丸ごと引き受けます。

```tsx
// React
import { Spreadsheet, SpreadsheetToolbar } from '@libraz/formulon-cell-react'
import '@libraz/formulon-cell-react/toolbar.css'

export function Sheet() {
  const [instance, setInstance] = useState<SpreadsheetInstance | null>(null)
  const [activeTab, setActiveTab] = useState<RibbonTab>('home')

  return (
    <>
      <SpreadsheetToolbar
        instance={instance}
        activeTab={activeTab}
        locale="ja"
        onTabChange={setActiveTab}
      />
      <Spreadsheet locale="ja" onReady={setInstance} />
    </>
  )
}
```

```vue
<!-- Vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { type RibbonTab, type SpreadsheetInstance } from '@libraz/formulon-cell'
import { Spreadsheet } from '@libraz/formulon-cell-vue'
import SpreadsheetToolbar from '@libraz/formulon-cell-vue/toolbar.vue'
import '@libraz/formulon-cell-vue/toolbar.css'

const instance = ref<SpreadsheetInstance | null>(null)
const activeTab = ref<RibbonTab>('home')
</script>

<template>
  <SpreadsheetToolbar :instance="instance" :active-tab="activeTab" locale="ja" @tab-change="(tab) => (activeTab = tab)" />
  <Spreadsheet locale="ja" @ready="(inst) => (instance = inst)" />
</template>
```

`dropdownActions` プロパティを使うと、リボンを fork せずに個々の dropdown ハンドラ（スクリプト / アドインのアクション、保護ダイアログなど）だけを上書きできます。

```tsx
<SpreadsheetToolbar
  instance={instance}
  activeTab={activeTab}
  locale="ja"
  onTabChange={setActiveTab}
  dropdownActions={{ applyProtectAction: openProtectDialog }}
/>
```

2 つのアダプタは同じプロパティ形状を持ち、処理は core に委譲します。framework wrapper とホスト側で組んだ toolbar は、同じ command path を使います。

### 独立した toolbar ホスト（高度）

単一呼び出しの `toolbar` オプションで足りない場合 ─ React / Vue を使わないホストで、リボンを（`.fc-host` の外の）**完全に独立した DOM ホスト**に置きたい、あるいは `SpreadsheetToolbar` が公開するより低レベルの制御が必要な場合 ─ は、core の `Spreadsheet.mountToolbar(host, instance, opts)` を直接呼べます。`theme` オプションと `ToolbarInstance.setTheme()` は、グリッドと同じ `paper` / `ink` / `contrast` 語彙を使います。

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

ホスト側の監査やカスタム chrome を組む場合は、リボンのコマンドセットを自前で再構築せず、core の共有マニフェスト（`ribbonActivationEntries`、`ribbonSurfaceCommandIds`、`DYNAMIC_RIBBON_DROPDOWN_HANDLER_ATTRS`）を import してください。

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

`@libraz/formulon-cell-react` は、自前でストア購読を組まずにインスタンス状態を読むための hooks も export しています。

| Hook | 説明 |
| --- | --- |
| `useSelection(instance)` | アクティブな選択範囲を購読 |
| `useSpreadsheet(instance, selector, fallback)` | ストアの `State` に対するセレクタを購読。SSR 安全な fallback 付き |
| `useI18n(instance)` | 現在のロケールと strings を読む。ランタイムの `setLocale`/`extend`/`register` に反応 |
| `useSpreadsheetEvent(instance, event, handler)` | `SpreadsheetInstance` のライフサイクルイベント（`cellChange`、`selectionChange`、…）を購読 |

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

`@libraz/formulon-cell-vue` は React アダプタと同じ 4 つの composables を export しており、自前でストア購読を組まずにインスタンス状態を読めます。

| Composable | 説明 |
| --- | --- |
| `useSelection(instance)` | アクティブな選択範囲を購読 |
| `useSpreadsheet(instance, selector, fallback)` | ストアの `State` に対するセレクタを購読。SSR 安全な fallback 付き |
| `useI18n(instance)` | 現在のロケールと strings を読む。ランタイムの `setLocale`/`extend`/`register` に反応 |
| `useSpreadsheetEvent(instance, event, handler)` | `SpreadsheetInstance` のライフサイクルイベント（`cellChange`、`selectionChange`、…）を購読 |

## 次に読むもの

- [i18n](/ja/cell/i18n) ─ ロケール登録と上書き
- [API 一覧](/ja/cell/api) ─ events / store / command
- [バンドラ設定](/ja/cell/bundler) ─ ホストに必要な配信設定
