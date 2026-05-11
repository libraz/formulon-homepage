# インストール

実行場所に合う利用面を選びます。Formulon 0.9 の package は alpha 扱いです。アプリケーションでは exact version を pin し、安定版まで API が増える可能性を前提にしてください。

::: warning Version を pin する
実験や internal tooling では exact package version を使ってください。API と packaging が pre-stable の間は `latest` に追従しない方が安全です。
:::

## JavaScript / WebAssembly

```sh
yarn add @libraz/formulon@0.9.0
```

ブラウザ、worker、Node サービスで WASM build を使う場合の入口です。Node で使う場合は Node 18+ が必要です。

Browser hosting では pthread worker のために cross-origin isolation を設定します。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Python

```sh
python -m pip install formulon==0.9.0
```

スクリプト、ノートブック、バッチジョブで使います。Wheel は Formulon C ABI の
standalone WASM module と、それを `wasmtime` 経由で呼ぶ pure-Python wrapper を
同梱します。NumPy、Cython、pybind11 は runtime では不要です。

## CLI

GitHub Releases から対象 OS / architecture のバイナリを取得します。`eval`、`recalc`、検査系のワークフローに向いています。

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

Package build は [ソースからビルド](/ja/development/build-from-source) を参照してください。
