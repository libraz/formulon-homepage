# インストール

実行場所に合う実行入口を選びます。Formulon のパッケージは 1.0 より前の段階です。アプリケーションでは正確なバージョンを固定し、安定版リリースまでは API が増える可能性を前提にしてください。

::: warning バージョンを固定する
実験や社内ツールでは、正確なパッケージバージョンを指定してください。API とパッケージ構成が安定するまでは、`latest` に追従しないほうが安全です。
:::

## JavaScript / WebAssembly

```sh
yarn add @libraz/formulon@0.12.0
```

ブラウザ、ワーカー、Node サービスで WASM ビルドを使う場合はこのパッケージを使います。ESM 専用で、Node で使う場合は Node 22 以降が必要です。

既定の WASM 入口と `formulon-cell` の標準ローダーは単一スレッドで動作し、オリジン間分離を必要としません。並列版の `@libraz/formulon/threads` を使う場合は、次のヘッダーを設定してください。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Python

```sh
python -m pip install formulon==0.12.0
```

スクリプト、ノートブック、バッチジョブで使います。wheel は Python 3.9 以降を対象とし、Formulon C ABI の単独の WebAssembly モジュールと、それを `wasmtime` 経由で呼び出す純 Python ラッパーを同梱しています。NumPy、Cython、pybind11 は実行時には不要です。

## CLI

GitHub Releases から対象 OS / CPU アーキテクチャのバイナリを取得します。`eval`、`recalc`、検査系のワークフローに向いています。

```sh
formulon --version
formulon eval '=SUM(1,2,3)'
formulon recalc input.xlsx -o output.xlsx
```

## formulon-cell

```sh
yarn add @libraz/formulon-cell@0.7.0 @libraz/formulon-cell-vue@0.7.0
```

Vue アダプターを使う場合は `@libraz/formulon-cell-vue` を追加します。フレームワーク用アダプターは共通のコアパッケージを使います。

## ソースから

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
make build
make test
```

パッケージビルドは [ソースからビルド](/ja/development/build-from-source) を参照してください。Native Node の配置手順は [Native Node 連携](/ja/runtimes/node-native) にあります。
