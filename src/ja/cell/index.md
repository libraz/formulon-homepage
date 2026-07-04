---
title: formulon-cell
description: formulon-cell は Formulon の結合試験と参考実装のために公開している UI ライブラリです。
---

# formulon-cell

`@libraz/formulon-cell` は、Formulon の **結合試験と参考実装のために公開している UI ライブラリ** です。`@libraz/formulon` WASM 計算エンジンの上に乗り、ブラウザ版をワークブック風の画面から検証できるようにします。

これは完成済みの表計算プロダクトではありません。全機能を網羅しているわけではなく、UI/UX を Excel に完全に寄せているわけでもなく、UI 側のバグをすべて取り切れているわけでもありません。エンジン結合を確認するための参考公開として扱ってください。

::: warning β（ベータ）─ 本番利用は非推奨
`formulon-cell` は、主に `@libraz/formulon` エンジンのデモンストレーションホストとして作られています。UI はまだ変化し続けているため、意図してアップグレードできるバージョン範囲に固定し、本番対応のスプレッドシートコンポーネントとしては扱わないでください。
:::

パッケージには、canvas グリッド、数式バー、ステータスバー、シートタブ、選択、キーボード編集、コンテキストメニュー、ランタイム i18n、テーマトークン、各種ダイアログなど、デスクトップ表計算ソフト風の UI 部品が含まれます。計算・読み込み・再計算・ヘッドレス回帰検査だけが目的なら、まず Formulon 本体の実行環境ドキュメントを読んでください。

::: info 用語: chrome（UI 用語）
UI の作業領域を囲む装飾部分 ─ ツールバー、メニュー、ステータスバー、スクロールバー、ダイアログなど。「Chrome ブラウザ」とは無関係です。
:::

::: info 用語: canvas-rendered grid
HTML `<canvas>` 上にグリッドを描画する方式で、セルを DOM ノードとして並べないため数万セル規模でも軽快に動きます。代わりに DOM ベースの a11y や CSS スタイルは canvas 周囲の chrome にしか効きません。
:::

## 位置づけ

- `@libraz/formulon` を裏に持つ実際のブラウザワークブックの結合確認
- 関数入力、数式再計算、セル結果の表示
- ホストアプリが再利用できるストア / コマンドヘルパーベースのスプレッドシート操作 API
- `en` / `ja` 辞書によるランタイム i18n
- CSS 変数による `paper`（明）/ `ink`（暗）/ `contrast`（ハイコントラスト）テーマ
- 結合試験と参考実装のための UI。Formulon の公式な完成 UI ではない

## パッケージ

| パッケージ | 用途 |
| --- | --- |
| `@libraz/formulon-cell` | Vanilla TS / DOM のコア。framework 非依存 |
| `@libraz/formulon-cell-react` | React 18+ コンポーネントと hooks |
| `@libraz/formulon-cell-vue` | Vue 3 コンポーネントと composables |

```sh
npm install @libraz/formulon-cell zustand
# adapter（任意）
npm install @libraz/formulon-cell-react react react-dom
npm install @libraz/formulon-cell-vue vue
```

::: info なぜ zustand が peer dependency なのか
組み込み UI が購読しているストアを、ホストアプリ側からも同じ実体で読めるようにするためです。ステータスバー、サイドパネル、解析オブザーバなどをパッケージを fork せずに作れます。
:::

## SharedArrayBuffer が無いと reject する

WASM エンジンは pthread 有効で配布されており、`SharedArrayBuffer` を必要とします。cross-origin isolation（`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`）が無い環境では、`WorkbookHandle.createDefault()` は **reject します** ─ 劣化したエンジンを黙って返すことはありません。ホスト側の設定不備は、いつまでも再計算されないスプレッドシートではなく、エラーとして現れるべきです。

<DiagramLayers :layers="[
  { nodes: ['Spreadsheet.mount(host, options)'] },
  { nodes: ['WorkbookHandle.createDefault()'] },
  { title: 'SharedArrayBuffer は利用可能か', nodes: [
    { label: 'はい', note: 'COOP/COEP が正しく設定済み' },
    { label: 'いいえ、preferStub 未指定', note: 'デフォルトの挙動' },
    { label: 'いいえ、preferStub: true', note: '明示的なオプトイン' }
  ] },
  { title: '結果', nodes: [
    { label: 'WASM エンジンを読込', note: '実際の再計算・.xlsx 往復保存・数式評価' },
    { label: 'Promise が reject', note: 'ホストが try/catch や MountOptions.onError で捕捉' },
    { label: '簡易エンジンを読込', note: 'wb.isStub / isUsingStub() → true ─ テスト・デモ専用' }
  ] }
]" label="Spreadsheet.mount のフロー: SharedArrayBuffer が無く preferStub も指定していない場合、WorkbookHandle.createDefault は reject する" />

`preferStub: true` はテストと明示的なデモ専用です ─ 本番の暗黙フォールバックとして使わないでください。reject に行き先を用意して呼び出します。

```ts
import { WorkbookHandle } from '@libraz/formulon-cell'

try {
  const wb = await WorkbookHandle.createDefault()
  // ここでは wb.isStub は false ─ 実際の WASM エンジンが動いている
} catch (err) {
  // SharedArrayBuffer が無い（COOP/COEP 未設定）か、WASM の初期化に失敗した
  showConfigurationError(err)
}

// テスト・デモ専用 ─ 本番の暗黙フォールバックとして使わないこと
const wb = await WorkbookHandle.createDefault({ preferStub: true })
wb.isStub // true
```

`Spreadsheet.mount()` も同じ reject を伝播します。core が組み込みのエラーパネルを描画する代わりに自分でハンドリングしたい場合は、`MountOptions.onError`（と任意で `renderError: false`）を渡してください。`onError` と各フレームワークアダプタの `error` イベント / `errorFallback` プロパティについては [埋め込みガイド](/ja/cell/embedding#ライフサイクルフック) を参照してください。

ホスト側のヘッダ設定は [バンドラ設定](/ja/cell/bundler)、実行時の動作条件は [インストール](/ja/cell/install) を参照してください。

## 参考プレイグラウンド

トップページにはコンパクトなライブ関数ピッカーを置いています。より大きい参考プレイグラウンドは同梱 `formulon-cell` UI をオーバーレイの子ウィンドウで開き、Formulon 本体や完成 UI と誤認されないようにしています。

[参考プレイグラウンドを開く](/ja/cell/demo)

## 次に読むもの

- [インストール](/ja/cell/install) ─ 導入と簡易エンジンの動作条件
- [バンドラ設定](/ja/cell/bundler) ─ Vite / webpack / esbuild の要件
- [埋め込みガイド](/ja/cell/embedding) ─ プリセット / 拡張 / コマンドヘルパー / ヘッドレス
- [i18n](/ja/cell/i18n) ─ ロケール切替と辞書登録
- [API 一覧](/ja/cell/api) ─ Spreadsheet / WorkbookHandle / events / store
