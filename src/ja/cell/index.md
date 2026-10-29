---
title: formulon-cell
description: ブラウザアプリケーションに Excel 風の表計算 UI を組み込む方法です。
---

# formulon-cell

`@libraz/formulon-cell` は、Web ページの中に表計算ソフトを組み込むための UI キットです。数式バー、リボン、シート見出し、ダイアログを備えたキャンバス描画のグリッドを表示し、計算は Formulon の WASM エンジンが行います。コアパッケージはフレームワークに依存しない DOM 実装で、React と Vue のパッケージは同じマウント処理を包む薄いアダプターです。

::: warning 互換性の現状
formulon-cell はデスクトップの表計算ソフトと同じ挙動を目指していますが、まだベータ版です。基本的なワークブック操作は使えます。一方、ダイアログ、コントロールの細かな挙動、キーボード操作、アクセシビリティはデスクトップ版と同等であることを保証しておらず、不具合が残っている可能性があります。そのまま置き換えられる製品や完成したエンドユーザー向け製品としてではなく、評価用の組み込み部品として扱ってください。
:::

現行リリースは `0.12.0` です。コアとアダプターは同じバージョンでインストールしてください。このリリースは `@libraz/formulon@0.18.0` を使い、Node.js 22 以降が必要です。インストールコマンドと最初のマウント例は [インストール](/ja/cell/install) にあります。

## パッケージ

| パッケージ | 用途 |
| --- | --- |
| `@libraz/formulon-cell` | ホストが DOM とライフサイクルを管理する場合に使います。 |
| `@libraz/formulon-cell-react` | React 18 以降のアプリケーションで使います。 |
| `@libraz/formulon-cell-vue` | Vue 3.3 以降のアプリケーションで使います。 |

アダプターはコアパッケージを依存関係としてインストールします。コアの型と、よく使う実行時ヘルパー（`WorkbookHandle`、`presets`、ポリシーヘルパー、拡張ファクトリー）はアダプターから再エクスポートされます。`exportCSV()` のような低レベルのコマンドヘルパーは `@libraz/formulon-cell` から読み込みます。

## 目的に合わせた始め方

次の 3 つのデモは、同じグリッドを異なる設定で表示します。周辺 UI、ユーザーが編集できるセル、表示範囲は、それぞれ独立したオプションです。

### 読み取り専用のワークブックビューアー

ワークブックを表示し、セルの選択とコピーだけを許可する場合は、`embedded` UI プロファイルと `viewerPolicy()` を使います。

```ts
import { Spreadsheet, viewerPolicy, WorkbookHandle } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const workbook = await WorkbookHandle.loadBytes(reportBytes)
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'embedded',
    theme: 'paper',
    features: { clipboard: true, shortcuts: true }
  },
  toolbar: false,
  policy: viewerPolicy(),
  contextMenu: { mode: 'disabled' }
})
```

レポートの一部だけを表示する場合は `viewport.range` を追加します。範囲の行と列は 0 始まりで、両端を含みます。詳しくは [オプション](/ja/cell/options) を参照してください。

<CellEmbedDemo scenario="viewer" />

### 入力セルを限定したフォーム

シートを事前入力し、指定したセルだけに値を入力できるようにする場合は `fixedFormPolicy()` を使います。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'embedded',
    features: { clipboard: true, shortcuts: true }
  },
  policy: fixedFormPolicy([
    { sheet: 0, r0: 2, c0: 1, r1: 20, c1: 3 }
  ]),
  viewport: {
    range: { sheet: 0, r0: 0, c0: 0, r1: 24, c1: 5 },
    tabNavigation: 'editable',
    tabBoundary: 'stop'
  }
})
```

初期値はホストから `instance.applyChanges()` で入力し、ユーザーの編集はポリシーで制御できます。ホスト更新とユーザー操作の違いは [埋め込み](/ja/cell/embedding) で説明します。

<CellEmbedDemo scenario="form" />

### アプリケーションがツールバーを所有する場合

周囲のツールバーやメニューをアプリケーション側で用意する場合は、`presets.minimal()` または `embedded` プロファイルから始めます。ホスト側のコンテキストメニュー、コマンドヘルパー、組み込みダイアログの起動メソッドを組み合わせられます。詳しくは [埋め込み](/ja/cell/embedding#host-owned-toolbar) を参照してください。

<CellEmbedDemo scenario="profiles" />

## ドキュメントの構成

- [インストール](/ja/cell/install) — パッケージ、スタイル、最初のマウント、サイズ、エラー、破棄。
- [バンドラ設定](/ja/cell/bundler) — Vite の設定と WASM アセットの確認。
- [オプション](/ja/cell/options) — UI プロファイル、機能スイッチ、ポリシー、ビューポート、メニュー、実行時変更。
- [プラットフォームと Mac UI](/ja/cell/platform) — `default`、`mac`、`auto` の選択と Mac 専用 UI。
- [言語を切り替える](/ja/cell/language-switching) — UI 辞書、ワークブックプロファイル、数式文字列、ホスト側コントロールを同期します。
- [埋め込み](/ja/cell/embedding) — ビューアー、フォーム、カスタム UI、ホスト更新。
- [モーダルとダイアログ](/ja/cell/modals) — オーバーレイの配置とダイアログ起動メソッド。
- [リボンツールバー](/ja/cell/toolbar) — インラインまたは独立したリボン、タブ構成、ドロップダウンの処理、コマンド。
- [グラフ](/ja/cell/charts) — グラフの作成、セルと系列の対応、設定できる項目。
- [セルの独自表示とホスト関数](/ja/cell/custom-cells) — 表示フォーマッターと、入力候補に出すホスト関数。
- [フレームワークアダプター](/ja/cell/frameworks) — React と Vue の利用方法。
- [フックとコンポーザブル](/ja/cell/hooks) — 選択、編集、言語設定に連動するホスト UI の例です。
- [API 一覧](/ja/cell/api) — 公開 API とイベント。
- [デモ](/ja/cell/demo) — 操作できるサンプル。
- [拡張](/ja/cell/extensions) — 任意 UI の追加、置換、削除。
- [テーマ](/ja/cell/theming) — 組み込みテーマと CSS トークンの上書き。
- [国際化](/ja/cell/i18n) — ロケール辞書とラベルの上書き。
- [ホスト連携](/ja/cell/host-integration) — ファイル、状態、印刷、ホストコールバック。
