---
title: formulon-cell のインストール
description: formulon-cell の表計算 UI キットをインストールしてマウントする方法です。
---

# インストール

コアパッケージと、それが共有依存として使う `zustand` をインストールします。

```sh
npm install @libraz/formulon-cell zustand
```

フレームワークを使う場合は、対応するアダプターもインストールします。

```sh
npm install @libraz/formulon-cell-react react react-dom
npm install @libraz/formulon-cell-vue vue
```

ブラウザのエントリーポイントでコアのスタイルシートを 1 回読み込みます。公開の読み込み先は `@libraz/formulon-cell/styles.css` です。

```ts
import '@libraz/formulon-cell/styles.css'
```

## クイックスタート

スプレッドシートをマウントする要素に高さを指定します。`Spreadsheet.mount()` は要素の子要素を管理し、ホストが所有するインスタンスを返します。

```html
<div id="sheet" style="height: 480px; min-height: 320px"></div>
```

```ts
import {
  Spreadsheet,
  WorkbookHandle,
  presets
} from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const host = document.querySelector<HTMLElement>('#sheet')!
let workbook: WorkbookHandle | undefined
let instance: Awaited<ReturnType<typeof Spreadsheet.mount>> | undefined
function disposeView() {
  instance?.dispose()
  instance = undefined
  workbook?.dispose()
  workbook = undefined
}

try {
  const nextWorkbook = await WorkbookHandle.createDefault({ locale: 'ja' })
  workbook = nextWorkbook
  instance = await Spreadsheet.mount(host, {
    workbook: nextWorkbook,
    features: presets.standard(),
    locale: 'ja'
  })
} catch (error) {
  showSpreadsheetError(error)
  disposeView()
}

// disposeView を周囲のビューの終了処理に登録します。
```

`WorkbookHandle.createDefault()` は Formulon の標準 WASM パッケージを読み込みます。現在の標準ローダーは `SharedArrayBuffer` や COOP/COEP ヘッダーを必要としません。WASM または WebAssembly の初期化に失敗すると Promise が拒否されるため、ホスト側でエラーを処理してください。

`Spreadsheet.mount()` の `onError` でもエラーを受け取れます。標準ではコアのエラーパネルが表示されます。フレームワークやホスト側でフォールバックを描画する場合は `renderError: false` を指定します。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  onError: (error) => showSpreadsheetError(error),
  renderError: false
})
```

## ホストのサイズ

グリッドはマウント先の要素いっぱいに表示されます。ホスト要素、または高さが確定している親レイアウトに高さを指定します。flex レイアウトでは、ホストを含むパネルに `min-height: 0` が必要になる場合があります。

```css
.sheet-panel {
  display: flex;
  min-height: 0;
  height: 100%;
}

.sheet-host {
  flex: 1 1 auto;
  min-height: 320px;
}
```

ホストがページから外れるときは `instance.dispose()` を呼びます。アプリケーションが所有する `WorkbookHandle` も不要になった時点で破棄します。React と Vue のアダプターはコンポーネントのライフサイクルに合わせてマウントと破棄を行います。

初回の `mount()` に渡したワークブックは呼び出し元が管理します。`mount()` が作成したワークブックと、`setWorkbook()` に渡した差し替え先はインスタンスが管理します。差し替え後、最初に渡したワークブックが不要になった時点で呼び出し元が破棄してください。

## スタブエンジンの明示的な利用

`WorkbookHandle.createDefault({ preferStub: true })` は、テストや小さなデモで使うメモリー上の簡易エンジン（スタブ）を明示的に選択します。WASM を読み込まない確認に使えますが、対応するワークブック機能は標準エンジンより少なくなります。自動フォールバックにはせず、テストやデモのコードで選択を明示してください。

UI プロファイルと機能の選び方は [オプション](/ja/cell/options)、Vite の設定は [バンドラ設定](/ja/cell/bundler) を参照してください。
