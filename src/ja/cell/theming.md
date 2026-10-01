---
title: テーマ
description: formulon-cell の組み込みテーマと、グリッドや浮動 UI に使う公開 CSS トークンを設定します。
---

# テーマ

`@libraz/formulon-cell/styles.css` を 1 回読み込み、組み込みテーマまたは CSS 変数の上書きを使います。同じテーマがグリッド、数式バー、メニュー、スプレッドシートのダイアログに適用されます。

## 組み込みテーマ

| テーマ | 用途 |
| --- | --- |
| `paper` | 明るい配色のアプリケーションです。デフォルトもこのテーマです。 |
| `ink` | 暗い配色のアプリケーションです。 |
| `contrast` | 境界を強くした高コントラストの配色です。 |

```ts
instance.setTheme('paper')
instance.setTheme('ink')
instance.setTheme('contrast')
```

`setTheme()` の後に `themeChange` が発生します。ユーザーの選択を次のマウントにも使う場合は、ホスト側で名前を保存します。

<CellEmbedDemo scenario="theme-locale" />

## ブランドテーマを作る

テーマ名には任意の文字列を使えます。独自の名前には完全な CSS パレットが必要で、`paper`、`ink`、`contrast` の色は自動で引き継がれません。通常は組み込みの `paper` を使い、ホスト側のラッパー内でブランド用の値だけを上書きします。

```css
.report-editor .fc-host[data-fc-theme="paper"],
.report-editor .fc-overlay-portal[data-fc-theme="paper"] {
  --fc-accent: #7c3aed;
  --fc-accent-strong: #6d28d9;
  --fc-accent-soft: color-mix(in srgb, var(--fc-accent) 12%, transparent);
  --fc-bg-rail: #f5f3ff;
  --fc-rule: #ddd6fe;
}
```

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: { theme: 'paper' },
  overlays: { root: overlayPortal },
})

instance.setTheme('paper')
```

`overlayPortal` は同じ `.report-editor` ラッパー内に置きます。グリッドの外側にあるメニューやダイアログにも上書きを適用しながら、このスプレッドシートの範囲に限定できます。独自のテーマ名も指定できますが、組み込みテーマのセレクターが一致しなくなるため、必要なパレットトークンをすべて定義してください。

## 公開グリッドトークン

サポート対象の名前は `styles/tokens.css` に定義されています。よく使うグループは次のとおりです。

| グループ | 例 | 対象 |
| --- | --- | --- |
| 背景 | `--fc-bg`、`--fc-bg-elev`、`--fc-bg-rail`、`--fc-bg-header`、`--fc-bg-hover` | グリッドと周辺 UI の背景です。 |
| 文字 | `--fc-fg`、`--fc-fg-strong`、`--fc-fg-mute`、`--fc-fg-faint` | セルと補助テキストです。 |
| 罫線 | `--fc-rule`、`--fc-rule-strong`、`--fc-rule-soft` | グリッド線と区切り線です。 |
| 選択 | `--fc-accent`、`--fc-accent-strong`、`--fc-accent-soft`、`--fc-selection-fill` | フォーカスと選択範囲です。 |
| セルの値 | `--fc-cell-error-fg`、`--fc-cell-formula-fg`、`--fc-cell-bool-fg`、`--fc-cell-num-fg` | 値の種類ごとの文字色です。 |
| 文字組み | `--fc-font-ui`、`--fc-font-mono`、`--fc-text-cell`、`--fc-text-header` | フォントとセルのサイズです。 |
| ダイアログ | `--fc-radius-md`、`--fc-shadow-8`、`--fc-shadow-16` | 浮動 UI とダイアログです。 |

トークンは `.fc-host` に直接指定します。ホスト要素の外に置かれるメニューやダイアログにも適用する場合は、対応する `.fc-overlay-portal` に同じ値を指定してください。ポータルが引き継ぐのはテーマ名で、ホストに限定した CSS 変数の上書きは自動では引き継ぎません。祖先セレクターで範囲を限定できますが、祖先要素だけに変数を設定しても、ホストに定義されたパッケージの値は上書きできません。パッケージの CSS カスケードレイヤーの外側に書いたホスト CSS で、既定の値を上書きできます。

```css
.report-editor .fc-host,
.report-editor .fc-overlay-portal {
  --fc-font-ui: "Inter", system-ui, sans-serif;
  --fc-text-cell: 14px;
  --fc-bg-rail: #f8fafc;
  --fc-accent: #0f766e;
}
```

ページ表示用の `--fc-page-*`、メニューアイコン、モーションのトークンを含む全一覧は `styles/tokens.css` を参照してください。一覧にない名前は内部実装です。

## 独立したリボンを調整する

ツールバーは独自の `--fc-tb-*` トークングループを使います。`.fc-host` 内にマウントしたツールバーは、グリッドのアクセントカラーに自動で追従します。独立した `SpreadsheetToolbar` では、ラッパーへツールバートークンを設定します。

```css
.app-toolbar {
  --fc-tb-accent: #0f766e;
  --fc-tb-accent-strong: #115e59;
  --fc-tb-ribbon-bg: #ffffff;
  --fc-tb-ribbon-hover: #f0fdfa;
}
```

React または Vue の独立したツールバーを使う場合は、コアのスタイルシートとアダプター用ツールバーのスタイルシートを読み込みます。`toolbar` オプションで 1 回のマウントを行う場合は、ツールバーがスプレッドシートのホスト要素の中に配置されます。

## オーバーレイとモーダルの色

ダイアログとメニューには、オーバーレイの配置先を通じてテーマ名が渡されます。ホストに限定した CSS 変数の上書きは自動で引き継がれません。ネイティブの `<dialog>`、全画面表示要素、アプリケーションのモーダル内にスプレッドシートを置く場合は、浮動 UI を同じ境界に保つために `overlays.root` へ要素を渡します。配置は [モーダルとオーバーレイ](/ja/cell/modals)、トークン名はこのページを参照してください。

## 次に読むページ

- [API 一覧](/ja/cell/api#theme-controller) ─ アプリケーションコードからテーマを切り替えます。
- [React / Vue アダプター](/ja/cell/frameworks) ─ フレームワークコンポーネントのインポートとサイズ指定
- [拡張](/ja/cell/extensions) ─ スタイルを決める前に機能面を選びます。
