---
title: formulon-cell
description: ブラウザアプリケーションに Excel 風の表計算 UI を組み込む方法です。
---

# formulon-cell

`@libraz/formulon-cell` は、ワークブックを表示・編集するグリッドをアプリケーションへ組み込むためのブラウザ UI キットです。フレームワークを使わないパッケージは DOM コアを提供し、React と Vue のパッケージは各フレームワーク向けのアダプターを提供します。Excel 風の画面を基本にしていますが、個々のコントロールや操作は継続して更新されます。

このドキュメントでは、表示する周辺 UI、編集できるセル、メニューやダイアログの配置、ホスト側のコントロールとの接続方法など、UI の更新に左右されにくい組み込み方を説明します。

このページのデモでは、表示する周辺 UI、操作権限、表示・移動できるセル範囲を個別に設定できます。

## パッケージ

| パッケージ | 用途 |
| --- | --- |
| `@libraz/formulon-cell` | ホストが DOM とライフサイクルを管理する場合に使います。 |
| `@libraz/formulon-cell-react` | React 18 以降のアプリケーションで使います。 |
| `@libraz/formulon-cell-vue` | Vue 3 のアプリケーションで使います。 |

コアパッケージは、`Spreadsheet.mount()`、`WorkbookHandle`、プリセット、ポリシー、ビューポートとコンテキストメニューのオプション、オーバーレイの配置、コードからダイアログを開くメソッドを提供します。フレームワークパッケージは同じ API を各フレームワークのライフサイクルに合わせてラップします。

## 目的に合わせた始め方

### 読み取り専用のワークブックビューアー

ワークブックを表示し、セルの選択とコピーだけを許可する場合は、`embedded` UI プロファイルと `viewerPolicy()` を使います。

```ts
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

周囲のツールバーやメニューをアプリケーション側で用意する場合は、`presets.minimal()` または `embedded` プロファイルから始めます。ホスト側のコンテキストメニュー、コマンドヘルパー、組み込みダイアログの起動メソッドを組み合わせられます。[モーダルとダイアログ](/ja/cell/modals) では、ネイティブ `<dialog>`、フレームワークのモーダル、全画面表示を扱います。

<CellEmbedDemo scenario="profiles" />

## ドキュメントの構成

- [インストール](/ja/cell/install) — パッケージ、スタイル、サイズ、エラー、破棄。
- [バンドラ設定](/ja/cell/bundler) — 現在の Vite 設定とアセット確認。
- [オプション](/ja/cell/options) — UI プロファイル、機能スイッチ、ポリシー、ビューポート、メニュー、実行時変更。
- [埋め込み](/ja/cell/embedding) — ビューアー、フォーム、カスタム UI、ホスト更新。
- [モーダルとダイアログ](/ja/cell/modals) — オーバーレイの配置とダイアログ起動メソッド。
- [フレームワークアダプター](/ja/cell/frameworks) — React と Vue の利用方法。
- [フックとコンポーザブル](/ja/cell/hooks) — 選択、編集、言語設定に連動するホスト UI の例です。
- [API 一覧](/ja/cell/api) — 公開 API とイベント。
- [デモ](/ja/cell/demo) — 操作できるサンプル。
- [拡張](/ja/cell/extensions) — 任意 UI の追加、置換、削除。
- [テーマ](/ja/cell/theming) — 組み込みテーマと CSS トークンの上書き。
- [国際化](/ja/cell/i18n) — ロケール辞書とラベルの上書き。
- [ホスト連携](/ja/cell/host-integration) — ファイル、状態、印刷、ホストコールバック。
