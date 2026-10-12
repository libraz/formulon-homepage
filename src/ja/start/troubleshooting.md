# トラブルシュート

よくある組み込み時の失敗を扱います。

<DiagramLayers
  :layers="[
    {
      title: '症状 → 対処法',
      nodes: [
        { label: 'SharedArrayBuffer が使えない', note: '明示的な /threads 入口にヘッダーを設定' },
        { label: 'バンドラが node:* を警告する', note: 'node: を external にし、optimizeDeps から除外' },
        { label: 'loadBytes が無効なハンドルを返す', note: 'wb.isValid() と lastErrorMessage() を確認' },
        { label: 'セルが #DIV/0! / #VALUE!', note: 'Excel エラーは値。値の種類を確認する' },
        { label: 'Python から WASM が見つからない', note: 'wheel をインストール、または make python-package' },
        { label: 'CLI の結果が Excel と違う', note: 'ロケール、揮発性関数、保持されるだけの構造を確認' }
      ]
    }
  ]"
  label="トラブルシューティング早見表"
/>

## SharedArrayBuffer が使えない

既定の `@libraz/formulon` 入口は単一スレッドで、`SharedArrayBuffer` を必要としません。このエラーは、アプリケーションが `@libraz/formulon/threads` や別の pthread 統合を明示的に読み込んだ場合に発生します。そのページではオリジン間分離のヘッダーを設定します。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

::: tip 本番ホストで確認する
ローカル開発サーバーではなく、実際の CDN / アプリケーションサーバーでヘッダーを確認してください。
:::

## Vite が `node:` のインポートを警告する

WASM パッケージには Node 実行環境向けの分岐が含まれ、threads 入口には `node:worker_threads` の分岐も含まれます。ブラウザ向けバンドラでは `node:module` や `node:worker_threads` の警告が出る場合があります。Vite では、このパッケージを `optimizeDeps` から除外し、`node:` の読み込みを外部として指定します。

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: { exclude: ['@libraz/formulon'] },
  build: {
    target: 'es2022',
    rollupOptions: { external: [/^node:/] }
  }
})
```

## ワークブックの読み込みが無効なハンドルを返す

WASM の `loadBytes(bytes)` は、不正な入力でも例外を送出しません。直後に `wb.isValid()` を確認し、`Module.lastErrorMessage()` を読んでください。ZIP アーカイブではないファイルの場合、メッセージは ZIP の読み込み処理から返ります。

```ts
const wb = Module.Workbook.loadBytes(bytes)
try {
  if (!wb.isValid()) {
    throw new Error(Module.lastErrorMessage())
  }
} finally {
  wb.delete()
}
```

Python の `Workbook.load(data)` は、無効なハンドルを返す代わりに `FormulonError` を送出します。

## 数式が Excel エラーを返す

Excel エラーは値です。`#DIV/0!`、`#VALUE!`、`#NAME?` はホスト API の失敗ではありません。`value.kind` が `ValueKind.Error` かを確認し、`value.errorCode`（Python は `error_code`）を読んでください。`Module.errorDisplayName(code)` を使うと、コードを `#DIV/0!` などの文字列に変換できます。

CLI も同じ規則です。不正な `eval` 構文（`formulon eval '=SUM('`）は `#NAME?` を stdout に出力して終了コード `0` を返します。数式テキストの不正を検出する場合は stdout を確認してください。非 0 終了は使い方、I/O、エンジンの失敗に使われます。

ワークブックを変更する API には別の構文境界があります。`setFormula()` は不正なテキストを `kParserUnexpectedToken` として拒否し、既存の数式とキャッシュ値を変更しません。XLSX / XLSB に保存済みの不正な数式は読み込みできますが、`recalc()` 後のセル値は `#NAME?` になります。ファイルを往復できることと、互換性検査で不正な数式を検出できることを両立できます。

## 入力規則が空セルを拒否する

WASM と Native Node で `allowBlank` を省略した場合の既定値は、Python と同じ `false` です。空セルを許可する入力規則では `allowBlank: true`（Python は `allow_blank=True`）を明示してください。

## Python が WASM 実行環境を読み込めない

公開 wheel をインストールして pip に互換性のある `wasmtime` wheel を解決させるか、リポジトリのルートで配置処理を実行します。

```sh
make python-package
```

ソースツリーから読み込む場合は、C ABI の WASM モジュールが `packages/python/formulon/_wasm/formulon_capi.wasm` に配置されている必要があります。別の場所でビルドしたモジュールを使うには、`FORMULON_WASM_PATH` にそのパスを設定します。同梱の配置場所が優先されます。

## CLI の結果が Excel と違う

まず次を確認してください。

- `PY` や CUBE 接続関数のように、外部サービスのスタブとして登録されているため意図的に Excel エラーを返す関数か。
- 選択したプロファイル（既定は `win-365-en_US`）と異なるロケールの挙動に依存していないか。
- CLI またはホストが意図した完全なプロファイル ID を適用しているか（ロケール変換は数値ロケールコードではなくプロファイル ID を使います）。
- 揮発性関数が絡んでいないか。
- 保持はされるが評価対象ではないワークブック構造に依存していないか。

最小の数式ケースを作り、[数式カバレッジ](/ja/compatibility/formula-coverage) と [Oracle テスト](/ja/compatibility/oracle-testing) を確認してください。
