---
title: React / Vue アダプター
description: formulon-cell を React / Vue から利用し、コアと同じ UI オプション、ホスト連携、イベントを使います。
---

# React / Vue アダプター

`@libraz/formulon-cell-react` と `@libraz/formulon-cell-vue` は、`Spreadsheet` コンポーネントと状態を読むためのフック / コンポーザブルを提供します。React はパッケージ直下から `SpreadsheetToolbar` をエクスポートし、Vue は `@libraz/formulon-cell-vue/toolbar.vue` サブパスでツールバーを公開します。マウントされる UI はコアパッケージと同じため、[埋め込み](/ja/cell/embedding) に記載したオプションをそのまま使えます。

## React でのマウント例

アプリケーションでコアのスタイルシートを 1 回読み込みます。コンポーネントの親に高さを与えると、グリッドがその領域を使います。

`locale` を明示すると、UI の辞書とワークブックの計算プロファイルがホストアプリケーションの言語に合います。これは UI の配置を選ぶ `ui.profile` とは別の設定です。

```tsx
import '@libraz/formulon-cell/styles.css'
import {
  Spreadsheet,
  fixedFormPolicy,
  type ContextMenuOptions,
  type SpreadsheetUiOptions,
  type ViewportOptions,
} from '@libraz/formulon-cell-react'

// モジュール定数にすると、再描画をまたいでプロパティの参照が変わりません。
const formRange = { sheet: 0, r0: 0, c0: 0, r1: 20, c1: 3 }
const ui: SpreadsheetUiOptions = {
  profile: 'embedded',
  theme: 'paper',
  features: { shortcuts: true, clipboard: true },
}
const policy = fixedFormPolicy([formRange])
const viewport: ViewportOptions = {
  range: formRange,
  tabNavigation: 'editable',
  tabBoundary: 'stop',
}
const contextMenu: ContextMenuOptions = { mode: 'disabled' }

export function OrderForm() {
  return (
    <div className="cell-frame">
      <Spreadsheet
        ui={ui}
        locale="ja"
        policy={policy}
        viewport={viewport}
        contextMenu={contextMenu}
        onReady={(instance) => console.log('spreadsheet ready', instance)}
        onChangeBatch={(event) => console.log('applied batch', event.revision)}
        onCellChange={(event) => console.log('draft changed', event.addr, event.value)}
      />
    </div>
  )
}
```

```css
.cell-frame {
  height: 560px;
  min-height: 0;
}

.cell-frame > * {
  height: 100%;
}
```

`onReady` は動作中の `SpreadsheetInstance` を受け取ります。外側の保存ボタンやホスト側ダイアログから `applyChanges()`、`print()`、`openFindReplace()` などを呼ぶ場合に保持します。`policy` は編集可能な操作を制御し、`viewport` は表示と移動の範囲を制御します。大きな画面内にフォームを埋め込む場合は、両方を組み合わせます。

アダプターは、プロパティが変わると対応するメソッドを動作中のインスタンスに対して呼びます。そのため `workbook`、`ui`、`toolbar`、`theme`、`locale`、`strings`、`features`、`extensions`、`policy`、`viewport`、`contextMenu`、`overlays`、プリンター関連、ステータス表示のプロパティを変更しても再マウントされません。プロパティには参照が変わらない値（state、`useMemo`、モジュール定数）を渡してください。描画のたびに新しいオブジェクトリテラルを渡すと変更とみなされ、設定が毎回適用し直されます。

`locale` プロパティが変わると `instance.setLocale()` が呼ばれます。編集中やダイアログ表示中などの理由で拒否された場合、React は `onError` と、維持されたロケールを持つ `onLocaleChange` で通知します。詳しくは [言語を切り替える](/ja/cell/language-switching#change-language-from-the-host) を参照してください。
## Vue でのマウント例

Vue パッケージは同じオプションをプロパティとして渡せます。テンプレート内のイベント名は `@cell-change` のようにケバブケースで記述します。

```vue
<script setup lang="ts">
import '@libraz/formulon-cell/styles.css'
import {
  fixedFormPolicy,
  Spreadsheet,
  type CellChangeEvent,
  type ContextMenuOptions,
  type SpreadsheetUiOptions,
  type ViewportOptions,
} from '@libraz/formulon-cell-vue'

// setup 内の定数にすると、再描画をまたいでプロパティの参照が変わりません。
const formRange = { sheet: 0, r0: 0, c0: 0, r1: 20, c1: 3 }
const ui: SpreadsheetUiOptions = {
  profile: 'embedded',
  theme: 'paper',
  features: { shortcuts: true, clipboard: true },
}
const policy = fixedFormPolicy([formRange])
const viewport: ViewportOptions = { range: formRange, tabNavigation: 'editable', tabBoundary: 'stop' }
const contextMenu: ContextMenuOptions = { mode: 'disabled' }

function saveDraft(event: CellChangeEvent) {
  console.log('draft changed', event.addr, event.value)
}
</script>

<template>
  <div class="cell-frame">
    <Spreadsheet
      :ui="ui"
      locale="ja"
      :policy="policy"
      :viewport="viewport"
      :context-menu="contextMenu"
      @cell-change="saveDraft"
      @change-batch="(event) => console.log(event.status)"
    />
  </div>
</template>

<style>
.cell-frame {
  height: 560px;
  min-height: 0;
}

.cell-frame > * {
  height: 100%;
}
</style>
```

コンポーネントに `ref` を付けると `{ instance }` を取得できます。親の操作からインスタンスのメソッドを呼ぶ場合に使います。`ready` イベントは、アプリケーションの状態へインスタンスを保存する場所として使えます。

## コンポーネントの主なオプション

両アダプターは次のオプションを `Spreadsheet.mount()` へ転送します。

| オプション | 主な用途 |
| --- | --- |
| `ui` | `embedded`、`minimal`、`standard`、`excel365`、`full` の UI、テーマ、`default`、`mac`、`auto` の `platform` を選びます。 |
| `theme` | `ui.theme` を `paper`、`ink`、`contrast`、または独自の名前で上書きします。 |
| `toolbar` | コンポーネント内にリボンを表示するか、リボンのオプションを渡します。省略すると `ui` のプロファイルに従い、`ui` もなければリボンは表示されません。[リボンツールバー](/ja/cell/toolbar) を参照してください。 |
| `policy` | 閲覧専用または入力セルだけ編集できるフォームを作ります。 |
| `viewport` | 表示・移動できるセル範囲と Tab 移動を設定します。 |
| `contextMenu` | 組み込みメニュー、変換したメニュー、ホスト側メニューを選びます。 |
| `overlays` | モーダルや全画面表示の中にメニューとダイアログを置きます。 |
| `workbook` | ホストが読み込んだワークブックを渡します。 |
| `getWorkbookName` | Watch Window に表示する現在のワークブック名を返します。コールバックはライブに読み取られ、`string`、`null`、`undefined` を返せます。 |
| `locale`、`strings` | UI 言語とラベルの上書きを設定します。組み込みセレクターは `ui.features.localeSwitcher` で有効にします。 |
| `features`、`extensions` | 組み込み UI の切り替えと追加機能を設定します。 |
| `getFunctionArgumentHelp` | Mac のパレットに型付きの引数ラベル、説明、参照 URL を渡します。 |
| `functions` | 数式の入力候補と `instance.formula` で使うホスト関数を登録します。[セルの独自表示とホスト関数](/ja/cell/custom-cells#host-functions) を参照してください。 |
| `seed` | コンポーネントが作成したワークブックへ、最初の描画前に値を入れます。 |
| `printerProfiles`、`printerProfileId`、`refreshPrinterProfiles` | ネイティブ / Electron のプリンター情報を接続します。 |
| `captureScreenClip` | 画面領域キャプチャをホストから提供します。 |
| `uploadStatus`、`macroRecording` | ステータスバーの表示をホストから更新します。 |

React には `className`、`style`、`onReady`、`onError`、`errorFallback`、`ref`（`instance` を持つ `SpreadsheetRef`）、`children`（ノード、または動作中のインスタンスを受け取る関数）もあります。Vue には `class`、`style`、`ready`、`error` イベント、`error-fallback` 関数があります。

## イベントとフック / コンポーザブル

React のイベントプロパティと Vue のイベントは同じイベントを扱います。

| React | Vue | 用途 |
| --- | --- | --- |
| `onChangeBatch` | `change-batch` | ホスト更新やユーザー操作で適用されたセル更新を受け取ります。 |
| `onCellChange` | `cell-change` | 変更された値や数式を下書き状態へ反映します。 |
| `onSelectionChange` | `selection-change` | インスペクターやホスト側の操作状態を更新します。 |
| `onWorkbookChange` | `workbook-change` | ワークブックを差し替えた後にホスト状態を更新します。 |
| `onLocaleChange` | `locale-change` | 選択した UI ロケールを保存します。 |
| `onThemeChange` | `theme-change` | ホストのテーマと同期します。 |
| `onRecalc` | `recalc` | 再計算後にホスト側の表示を更新します。 |

React のフックと Vue のコンポーザブルは、選択状態、必要な表示値、変更イベント、言語設定をホスト側のコントロールへ接続します。[フックとコンポーザブルの利用例](/ja/cell/hooks) に、選択セルのインスペクター、変更表示、言語の同期、拒否された編集の表示をまとめています。

`selection-change` イベントに含まれるのはアクティブセル、アンカー、主選択範囲だけです。ホストパネルで非連続の範囲も読む場合は、`useSelection()` または `useSpreadsheet()` から `state.selection.extraRanges` を取得します。

## ツールバーコンポーネント {#toolbar-component}

`SpreadsheetToolbar` は `Spreadsheet` コンポーネントの外にリボンをマウントします。プロパティ、インラインの `toolbar` オプション、スタイルは [リボンツールバー](/ja/cell/toolbar) を参照してください。

## マウントエラーとフォールバック

インスタンスを作れない場合に `onError` / `error` が呼ばれます。React は `errorFallback` でノードまたは描画関数を返せ、Vue は `error-fallback` から VNode を返せます。ホスト側で初期化エラーと再試行ボタンを表示できます。

```tsx
<Spreadsheet
  onError={(error) => reportMountError(error)}
  errorFallback={(error) => <MountError error={error} />}
/>
```

## 次に読むページ

- [フックとコンポーザブル](/ja/cell/hooks) — 選択状態、変更通知、言語設定を利用する具体例です。
- [言語を切り替える](/ja/cell/language-switching) — ホスト API、任意のセレクター、数式プロファイル、切り戻しを説明します。
- [埋め込み](/ja/cell/embedding) ─ vanilla のマウント、オプション、モーダル配置
- [プラットフォームと Mac UI](/ja/cell/platform) ─ プラットフォーム、Mac リボン、引数ヘルプ
- [リボンツールバー](/ja/cell/toolbar) ─ `SpreadsheetToolbar`、インラインのリボン、ドロップダウンの処理
- [ホスト統合](/ja/cell/host-integration) ─ 保存、ステータス表示、印刷、ホストコールバック
- [国際化](/ja/cell/i18n) ─ 実行時ロケールと文字列上書き
