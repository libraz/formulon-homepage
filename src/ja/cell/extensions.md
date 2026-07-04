---
title: formulon-cell 拡張カタログ
description: 組み込みの 26 個の拡張ファクトリと、対応する機能フラグ、役割、プリセットへの収録状況。
---

# 拡張カタログ

このページは、`formulon-cell` の置換可能な chrome をファクトリ単位で網羅するリファレンスです。`features` と `extensions` のアーキテクチャは [埋め込みガイド](/ja/cell/embedding#選択的な拡張) を参照してください ─ この表は、ガイド全体を読まずに 1 個のファクトリを調べられるようにするためのものです。

各エントリは参考 chrome の一部としてマウントされます ─ 結合試験と実装例には有用ですが、個々のダイアログが Excel の挙動と完全に一致する保証ではありません。

::: info 用語: プリセットと拡張
*プリセット*（`presets.minimal()` / `.standard()` / `.full()`）はブール値のプレーンな `FeatureFlags` オブジェクトです。*拡張* は `Extension` を返す引数なしのファクトリ関数です。機能フラグを無効にすると組み込みとその DOM が外れ、対応するファクトリを `extensions` に渡すと自分のもの（あるいは同じ組み込みを単体で再利用したもの）がマウントされます。
:::

## ファクトリ

各ファクトリの `id` は、`mount.ts` がゲートに使う `FeatureFlags` のキーと一致します ─ フラグを無効にしたうえで、ファクトリ（または自作の代替）を `extensions` に渡してください。各列は、そのファクトリが各プリセットのデフォルト chrome に含まれるかを示します。

| ファクトリ | Feature id | 役割 | `minimal()` | `standard()` | `full()` |
| --- | --- | --- | --- | --- | --- |
| `borderDraw` | `borderDraw` | セル罫線の描画 / グリッド描画 / 消去モード | – | ✓ | ✓ |
| `charts` | `charts` | セッション内チャートオーバーレイ | – | ✓ | ✓ |
| `clipboard` | `clipboard` | OS クリップボード連携（コピー / 切り取り / 貼り付け） | ✓ | ✓ | ✓ |
| `commentDialog` | `commentDialog` | コメント編集ダイアログ（Shift+F2） | – | – | ✓ |
| `conditionalDialog` | `conditional` | 条件付き書式のルールマネージャ | – | – | ✓ |
| `contextMenu` | `contextMenu` | 右クリックのコンテキストメニュー | – | ✓ | ✓ |
| `findReplace` | `findReplace` | 検索 / 置換ダイアログ（Ctrl+F） | – | ✓ | ✓ |
| `formatDialog` | `formatDialog` | セルの書式設定ダイアログ（Ctrl+1） | – | – | ✓ |
| `formatPainter` | `formatPainter` | 書式コピー | – | ✓ | ✓ |
| `goToSpecialDialog` | `gotoSpecial` | ジャンプ（Go To Special）ダイアログ | – | – | ✓ |
| `hoverComment` | `hoverComment` | ホバーコメントのポップオーバー | – | – | ✓ |
| `hyperlinkDialog` | `hyperlink` | ハイパーリンクダイアログ（Ctrl+K） | – | – | ✓ |
| `illustrations` | `illustrations` | セッション内の図形 / 画像オーバーレイ | – | ✓ | ✓ |
| `iterativeDialog` | `iterative` | 反復計算の設定ダイアログ | – | – | ✓ |
| `namedRangeDialog` | `namedRanges` | 名前定義の一覧ダイアログ | – | – | ✓ |
| `pageSetupDialog` | `pageSetup` | ページ設定ダイアログ | – | – | ✓ |
| `pasteSpecial` | `pasteSpecial` | 形式を選択して貼り付けダイアログ | – | – | ✓ |
| `pivotTableDialog` | `pivotTableDialog` | ピボットテーブル作成ダイアログ | – | – | ✓ |
| `quickAnalysis` | `quickAnalysis` | クイック分析のポップオーバー（Ctrl+Q） | – | ✓ | ✓ |
| `slicer` | `slicer` | スライサーのフローティングパネル | 明示オプトインのみ | 明示オプトインのみ | 明示オプトインのみ |
| `statusBar` | `statusBar` | 下部ステータスバー（計算モード、ズーム、集計） | ✓ | ✓ | ✓ |
| `validationList` | `validation` | 入力規則リストのドロップダウン | – | – | ✓ |
| `viewToolbar` | `viewToolbar` | 表示リボンツールバー | – | ✓ | ✓ |
| `watchWindow` | `watchWindow` | ウォッチウィンドウのドック | 明示オプトインのみ | 明示オプトインのみ | 明示オプトインのみ |
| `wheel` | `wheel` | マウスホイールのスクロールハンドラ | ✓ | ✓ | ✓ |
| `workbookObjects` | `workbookObjects` | ワークブックオブジェクトのサイドパネル | – | ✓ | ✓ |

```ts
import { Spreadsheet, presets, findReplace, formatDialog } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace(), formatDialog()]
})
```

::: warning `watchWindow` と `slicer` は `full()` でもデフォルト off
この 2 つの id は、ほかの全機能が従う「明示的に無効化しない限り on」というルールの例外です ─ 初期状態が無効で、`presets.full()` の下でも `features: { watchWindow: true }` / `{ slicer: true }`（または対応するファクトリを `extensions` に渡す）という明示オプトインが無いと現れません。新しいパネルはこの形で出荷されるため、formulon-cell のアップグレードを取り込んでもデフォルト chrome が黙って増えることはありません。
:::

## フラグのみの機能（ファクトリなし）

一部の `FeatureFlags` id は、独立してマウントできるダイアログやパネルではない挙動をゲートします ─ これらには `extensions` に渡すものが無く、ブール値のフラグだけがあります。

| Feature id | ゲートする対象 | `minimal()` | `standard()` | `full()` |
| --- | --- | --- | --- | --- |
| `formulaBar` | 数式入力バー | ✓ | ✓ | ✓ |
| `shortcuts` | 組み込みのスプレッドシート用キーマップ | ✓ | ✓ | ✓ |
| `sheetTabs` | 下部のシートタブバー | – | ✓ | ✓ |
| `errorIndicators` | セル隅の緑の三角形によるエラーマーカー | – | ✓ | ✓ |
| `autocomplete` | 入力中のインライン数式 / 名前自動補完 | – | ✓ | ✓ |
| `fxDialog` | 関数の挿入（fx）ダイアログ / 引数ヘルパー | – | – | ✓ |

## 無効化できないコア

`nameBox`、`editor`、`pointer`、`renderer` はそもそも `FeatureFlags` の id ではありません ─ スプレッドシートの表示面そのものです。無効化するフラグは存在せず、外してしまうとマウントする UI が残りません。

## 次に読むもの

- [埋め込みガイド](/ja/cell/embedding#選択的な拡張) ─ `features` と `extensions` の使い分け、ヘッドレスマウント、コマンドヘルパー
- [API 一覧](/ja/cell/api#拡張) ─ `MountOptions.extensions`、`presets`
- [テーマ](/ja/cell/theming) ─ 残した chrome に効く CSS トークン
