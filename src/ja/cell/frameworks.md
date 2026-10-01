---
title: React / Vue アダプター
description: formulon-cell を React / Vue から利用し、コアと同じ UI オプション、ホスト連携、イベントを使います。
---

# React / Vue アダプター

`@libraz/formulon-cell-react` と `@libraz/formulon-cell-vue` は、`Spreadsheet` コンポーネント、独立したツールバーコンポーネント、状態を読むためのフック / コンポーザブルを提供します。マウントされる UI はコアパッケージと同じため、[埋め込み](/ja/cell/embedding) に記載したオプションをそのまま使えます。

## React でのマウント例

アプリケーションでコアのスタイルシートを 1 回読み込みます。コンポーネントの親に高さを与えると、グリッドがその領域を使います。

```tsx
import '@libraz/formulon-cell/styles.css'
import '@libraz/formulon-cell-react/toolbar.css'
import {
  Spreadsheet,
  fixedFormPolicy,
} from '@libraz/formulon-cell-react'

const formRange = { sheet: 0, r0: 0, c0: 0, r1: 20, c1: 3 }

export function OrderForm() {
  return (
    <div className="cell-frame">
      <Spreadsheet
        ui={{
          profile: 'embedded',
          theme: 'paper',
          features: { shortcuts: true, clipboard: true },
        }}
        policy={fixedFormPolicy([formRange])}
        viewport={{
          range: formRange,
          tabNavigation: 'editable',
          tabBoundary: 'stop',
        }}
        contextMenu={{ mode: 'disabled' }}
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

アダプターはマウント後のプロパティ変更を動作中のインスタンスへ反映します。`theme`、`locale`、`strings`、`ui`、`features`、`extensions`、`policy`、`viewport`、`contextMenu`、`overlays`、ホスト側のステータスプロパティを変更しても再マウントは必要ありません。`policy` が有効な間は、ほかの機能フラグが有効でも組み込み UI は数式バー、クリップボード、ショートカット、ホイール操作、コンテキストメニューに限られます。詳しくは [オプション](/ja/cell/options#operation-policy) を参照してください。

## Vue でのマウント例

Vue パッケージは同じオプションをプロパティとして渡せます。テンプレート内のイベント名は `@cell-change` のようにケバブケースで記述します。

```vue
<script setup lang="ts">
import '@libraz/formulon-cell/styles.css'
import '@libraz/formulon-cell-vue/toolbar.css'
import { fixedFormPolicy, Spreadsheet } from '@libraz/formulon-cell-vue'

const formRange = { sheet: 0, r0: 0, c0: 0, r1: 20, c1: 3 }

function saveDraft(event: { addr: unknown; value: unknown }) {
  console.log('draft changed', event.addr, event.value)
}
</script>

<template>
  <div class="cell-frame">
    <Spreadsheet
      :ui="{ profile: 'embedded', theme: 'paper', features: { shortcuts: true, clipboard: true } }"
      :policy="fixedFormPolicy([formRange])"
      :viewport="{ range: formRange, tabNavigation: 'editable', tabBoundary: 'stop' }"
      :context-menu="{ mode: 'disabled' }"
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
| `ui` | `embedded`、`minimal`、`standard`、`full` の UI とテーマを選びます。 |
| `toolbar` | コンポーネント内にリボンを表示します。 |
| `policy` | 閲覧専用または入力セルだけ編集できるフォームを作ります。 |
| `viewport` | 表示・移動できるセル範囲と Tab 移動を設定します。 |
| `contextMenu` | 組み込みメニュー、変換したメニュー、ホスト側メニューを選びます。 |
| `overlays` | モーダルや全画面表示の中にメニューとダイアログを置きます。 |
| `workbook` | ホストが読み込んだワークブックを渡します。 |
| `locale`、`strings` | UI 言語とラベルの上書きを設定します。 |
| `features`、`extensions` | 組み込み UI の切り替えと追加機能を設定します。 |
| `functions` | マウント前にホスト側の数式関数を登録します。 |
| `printerProfiles`、`refreshPrinterProfiles` | ネイティブ / Electron のプリンター情報を接続します。 |
| `captureScreenClip` | 画面領域キャプチャをホストから提供します。 |
| `uploadStatus`、`macroRecording` | ステータスバーの表示をホストから更新します。 |

React には `className`、`style`、`children`、`onReady`、`onError`、`errorFallback` もあります。Vue には `class`、`style`、`ready`、`error` イベント、`error-fallback` 関数があります。

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

## ツールバーコンポーネント

リボンをスプレッドシートと別のレイアウトへ置く場合は `SpreadsheetToolbar` を使います。`onReady` またはコンポーネントの `ref` から取得したインスタンスを渡します。

```tsx
<SpreadsheetToolbar
  instance={instance}
  activeTab={activeTab}
  locale="ja"
  onTabChange={setActiveTab}
  onToolbarReady={setToolbar}
  dropdownActions={{
    applyProtectAction: () => openHostDialog('protect'),
  }}
/>
```

リボンを同じホストに含める場合は `Spreadsheet` の `toolbar` を使います。アプリケーションがタイトルバーや全体のレイアウトを所有する場合は `SpreadsheetToolbar` を使います。ツールバーはタブ一覧と、スクリプト、アドイン、スペルチェック、翻訳、描画などのホスト操作用コールバックを受け取ります。

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
- [埋め込み](/ja/cell/embedding) ─ vanilla のマウント、オプション、モーダル配置
- [ホスト統合](/ja/cell/host-integration) ─ 保存、ステータス表示、印刷、ホストコールバック
- [国際化](/ja/cell/i18n) ─ 実行時ロケールと文字列上書き
