# インストール

実行場所に合う実行入口を選びます。Formulon のパッケージは pre-1.0 段階です。アプリケーションでは正確なバージョンを固定し、安定版リリースまでは API が増える可能性を前提にしてください。

::: warning バージョンを固定する
実験や社内ツールでは、正確なパッケージバージョンを指定してください。API とパッケージ構成が安定するまでは、`latest` に追従しないほうが安全です。
:::

## JavaScript / WebAssembly

```sh
yarn add @libraz/formulon@0.10.0
```

ブラウザ、worker、Node サービスで WASM ビルドを使う場合はこのパッケージを使います。ESM 専用で、Node で使う場合は Node 22 以降が必要です。

ブラウザで配信する場合は、pthread ワーカーのために cross-origin isolation を設定します。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Python

```sh
python -m pip install formulon==0.10.0
```

スクリプト、ノートブック、バッチジョブで使います。wheel には Formulon C ABI の
単体 WebAssembly モジュールと、それを `wasmtime` 経由で呼び出す純 Python ラッパーが
同梱されています。NumPy、Cython、pybind11 は実行時には不要です。

## CLI

GitHub Releases から対象 OS / CPU アーキテクチャのバイナリを取得します。`eval`、`recalc`、検査系のワークフローに向いています。

```sh
formulon --version
formulon eval '=SUM(1,2,3)'
formulon recalc input.xlsx -o output.xlsx
```

## ソースから

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
make build
make test
```

パッケージビルドは [ソースからビルド](/ja/development/build-from-source) を参照してください。
