---
title: formulon-cell のプラットフォーム
description: 既定または Mac のスプレッドシート UI を選び、Mac 専用 UI をホストアプリケーションへ接続します。
---

# プラットフォームと Mac UI

スプレッドシートのプラットフォームは `ui.platform` で選択します。`ui.profile` とは独立しており、プロファイルが機能の範囲を選び、プラットフォームが固有の操作やリボンの配置を選びます。

| 値 | 動作 |
| --- | --- |
| `default` | 既定のスプレッドシート UI を使います。`platform` を省略した場合の既定値です。 |
| `mac` | Mac のリボンと操作方法を明示的に選びます。 |
| `auto` | ブラウザーのプラットフォームから解決します。iPad と iPhone のユーザーエージェント、およびタッチ対応の `MacIntel` は `default` にフォールバックします。 |

マウント前に解決結果が必要な場合は、リゾルバーを使います。

```ts
import {
  resolveSpreadsheetPlatform,
  Spreadsheet,
  type SpreadsheetPlatform,
} from '@libraz/formulon-cell'

const requested: SpreadsheetPlatform = 'auto'
const resolved = resolveSpreadsheetPlatform(requested)
const instance = await Spreadsheet.mount(host, {
  ui: { profile: 'excel365', platform: requested },
})

console.log(resolved) // 'mac' または 'default'
```

`ui.platform` は選択済みの `ui.profile` を変更しません。たとえば `{ profile: 'embedded', platform: 'mac' }` は埋め込み用の表示を保ちながら、Mac のプラットフォーム動作を選びます。マウント後に両方を変更することもできます。

```ts
instance.setUi({ profile: 'excel365', platform: 'mac', theme: 'paper' })
```

`setUi()` は現在のワークブックを保ったまま、プロファイル、プラットフォーム、テーマを再解決します。省略した項目は既定値に戻るため、維持したい UI 設定もまとめて渡します。マウント時に渡したトップレベルの `features`、`theme`、`toolbar` も再適用します。Mac から別のプラットフォームへ変更すると、開いている数式パレットを閉じ、保留中の編集下書きを破棄します。ワークブック自体は置き換えません。トップレベルの設定だけを変更する場合は `setFeatures()`、`setTheme()`、`setToolbar()` を使います。優先順位は [オプション](/ja/cell/options) を参照してください。

## Mac リボン

Mac のプラットフォームには、専用のリボンタブ、ショートカット、ダイアログがあります。独立したツールバーを作るホストは、公開されているリボンモデルを明示的に選べます。

```ts
import { buildRibbonModel, type RibbonProfile } from '@libraz/formulon-cell'

const profile: RibbonProfile = 'excel365Mac'
const tabs = buildRibbonModel('ja', { profile })
```

組み込みの Mac リボンは `ui.platform: 'mac'` で使えます。描画タブには黒と赤のペン、鉛筆、蛍光ペン、消しゴム、トラックパッドの操作があります。インクはマウント中のセッション用イラスト層に保存され、1 ストロークは最大 2,000 点です。ワークブックのデータには書き込まれず、`.xlsx` に保存されません。ストロークを確定する前に、現在のポリシーで対象セルが認可されます。

ショートカット機能が有効な場合、グリッドでは次の Mac 用キー操作を使えます。

| ショートカット | 操作 |
| --- | --- |
| `Control+U` | アクティブセルの既存の内容を編集します。 |
| `Command+Control+V` | 対応する機能が有効な場合、形式を選択して貼り付けを開きます。 |
| `Option+Left` / `Option+Right` | 前または次のシートへ移動します。 |

## 関数の引数パレット

Mac の関数の引数パレットはモーダルではありません。開くとインライン編集または数式バーの下書きを一時停止し、キャンセルで下書きの文字列、フォーカス、キャレットまたは選択範囲を復元します。複合数式の関数呼び出し内にキャレットがある場合も同じです。引数を編集すると、周囲の数式を保ったまま対象の関数呼び出しだけが変更されます。ピッカーは現在のワークブックから関数カタログを読み、カテゴリ別に表示します。「最近使った関数」には、マウント中のスプレッドシートで挿入に成功した関数を記録します。

ホスト UI から開くには `openFunctionArguments(seedName?, { category })` を使います。`seedName` が関数名の場合は `category` を無視します。利用できるカテゴリは `all`、`recent`、`logical`、`lookup`、`text`、`datetime`、`math`、`financial`、`dynamicArray`、`statistical`、`engineering`、`information`、`database`、`compatibility`、`cube`、`web` です。

`getFunctionArgumentHelp` には関数の正規名、0 始まりの引数インデックス、現在のロケールが渡されます。`label` を省略するとカタログの引数ラベルを使います。説明と参照リンクはホスト側のプロバイダーから取得します。パレットは引数インデックス `0` の戻り値からヘルプリンクを読みます。オブジェクト内のプロパティの順序は関係ありません。

```ts
import { Spreadsheet, type FunctionArgumentHelpProvider } from '@libraz/formulon-cell'

const getFunctionArgumentHelp: FunctionArgumentHelpProvider = (
  functionName,
  argumentIndex,
  locale,
) => {
  if (functionName.toUpperCase() !== 'SUM' || argumentIndex !== 0) return null
  const japanese = locale.toLowerCase().startsWith('ja')
  return {
    url: japanese ? '/ja/workbook/formula-engine' : '/workbook/formula-engine',
    label: japanese ? '数値' : 'numbers',
    description: japanese ? '加算する値または範囲です。' : 'The values or range to add.',
  }
}

const instance = await Spreadsheet.mount(host, {
  ui: { profile: 'excel365', platform: 'mac' },
  getFunctionArgumentHelp,
})
```

React と Vue のアダプターも `FunctionArgumentHelp` と `FunctionArgumentHelpProvider` をエクスポートし、コールバックをコアのマウントへ渡します。Vue の例では、コールバックをコンポーネントのプロパティとして受け取ります。

::: code-group

```tsx [React]
import { Spreadsheet } from '@libraz/formulon-cell-react'

<Spreadsheet
  ui={{ profile: 'excel365', platform: 'mac' }}
  getFunctionArgumentHelp={getFunctionArgumentHelp}
/>
```

```vue [Vue]
<script setup lang="ts">
import { Spreadsheet } from '@libraz/formulon-cell-vue'
import type { FunctionArgumentHelpProvider } from '@libraz/formulon-cell-vue'

defineProps<{ getFunctionArgumentHelp: FunctionArgumentHelpProvider }>()
</script>

<template>
  <Spreadsheet
    :ui="{ profile: 'excel365', platform: 'mac' }"
    :get-function-argument-help="getFunctionArgumentHelp"
  />
</template>
```

:::

## Mac リボンのダイアログ

これらのダイアログは Mac リボンから開きます。ホスト側のツールバーでは、表のコマンド ID を `ToolbarInstance.applyCommand(id)` に渡します。フレームワークのアダプターでは `onToolbarReady` からツールバーのインスタンスを取得できます。戻り値の真偽値は、対応するハンドラーが見つかったかどうかを表します。ゴール シーク、統合、小計は、ワークブックを変更する前にインスタンスのポリシーを確認します。

| リボンの経路 | コマンド ID | 対応範囲と上限 |
| --- | --- | --- |
| データ → What-If 分析 → ゴール シーク | `mac.data.goalSeek` | 最大 100 回の反復で解を求めます。 |
| データ → 統合 | `mac.data.consolidate` | `sum`、`average`、`count`、`min`、`max` に対応し、統合するソース範囲は合計 100,000 セルまでです。 |
| データ → 小計 | `mac.data.subtotal` | アクティブシートのみです。入力は 100,000 行、出力は 100,000 セル、グループは 1,000 個までです。エンジンの `SUBTOTAL` 対応が必要で、処理できないオブジェクトや空きのない出力領域は拒否されます。 |
| 挿入 → スパークライン | `mac.insert.sparkline` | 矩形のソース範囲、1 セルの出力先、`line`、`column`、`win-loss` に対応します。 |
| 挿入 → スライサー | `mac.insert.slicer` | 既存のワークブックテーブルと、そのテーブルの列が必要です。 |
| 校閲 → ブック統計 | `mac.review.stats` | シート、入力済みセル、数式、数値、文字列、ブール値、エラー、テーブル、コメント、ハイパーリンク、使用行、使用列を数え、開くたびに再集計します。 |

小計などの Mac データ操作もポリシーの対象で、Undo / Redo に記録されます。ホストのポリシー、オーバーレイ、ヘルパーは [オプション](/ja/cell/options)、[API 一覧](/ja/cell/api)、[モーダルとダイアログ](/ja/cell/modals)、[埋め込み](/ja/cell/embedding) を参照してください。

## 関連ページ

- [オプション](/ja/cell/options) — プロファイル、プラットフォーム、機能、ポリシーの解決。
- [API 一覧](/ja/cell/api) — リゾルバーの型、リボンモデル、ホストヘルパー。
- [React / Vue アダプター](/ja/cell/frameworks) — アダプターのプロパティとイベント境界。
- [フックとコンポーザブル](/ja/cell/hooks) — ホストパネルでの複数範囲の状態。
- [デモ](/ja/cell/demo) — ヘッダーで既定、Mac、自動を切り替える例。
