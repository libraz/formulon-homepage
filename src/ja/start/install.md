# インストール

ワークブックを動かす場所に合う実行入口を選びます。

::: warning バージョンを固定する
Formulon は 1.0 より前の段階で、API とパッケージ構成はリリースごとに変わる可能性があります。実験や社内ツールでも `latest` に追従せず、正確なバージョンを指定してインストールしてください。
:::

以下のインストール例は、ここで説明する API を含む Formulon 0.15.2 と formulon-cell 0.9.1 を固定しています。同じリリースを自分でビルドする場合は、[ソースからビルドする](/ja/development/build-from-source)を参照してください。cell パッケージは別のリリース周期です。実行時のロケールと計算プロファイルの操作は [言語切り替え](/ja/cell/language-switching)にまとめています。

## JavaScript / WebAssembly

```sh
yarn add @libraz/formulon@0.15.2
```

ブラウザ、ワーカー、Node サービスで WASM ビルドを使う場合はこのパッケージを使います。ESM 専用で、Node で使う場合は Node 22 以降が必要です。

既定の WASM 入口と `formulon-cell` の標準ローダーは単一スレッドで動作し、オリジン間分離を必要としません。並列版の `@libraz/formulon/threads` を使う場合は、次のヘッダーを設定してください。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Python

```sh
python -m pip install formulon==0.15.2
```

スクリプト、ノートブック、バッチジョブで使います。wheel は Python 3.9 以降を対象とし、Formulon C ABI の単独の WebAssembly モジュールと、それを `wasmtime` 経由で呼び出す純 Python ラッパーを同梱しています。NumPy、Cython、pybind11 は実行時には不要です。

## CLI

シェルや CI から `eval`、`recalc`、ワークブックの検査を行うには単体バイナリを使います。[GitHub Releases](https://github.com/libraz/formulon/releases) にはプラットフォームごと（`darwin-arm64`、`linux-x64`、`linux-arm64`）のアーカイブがあり、それぞれ `.sha256` のチェックサムファイルが付いています。

```sh
curl -LO https://github.com/libraz/formulon/releases/download/v0.15.2/formulon-0.15.2-linux-x64.tar.gz
tar -xzf formulon-0.15.2-linux-x64.tar.gz
export PATH="$PWD/formulon-0.15.2-linux-x64:$PATH"

formulon --version
formulon eval '=SUM(1,2,3)'
formulon recalc input.xlsx -o output.xlsx
```

どのサブコマンドも、計算プロファイルを指定する `--profile` と、評価時刻を固定する `--now` を受け付けます。

## formulon-cell

```sh
yarn add @libraz/formulon-cell@0.9.1 @libraz/formulon-cell-vue@0.9.1
```

`@libraz/formulon-cell` はフレームワークに依存しないコアです。使うフレームワークに合わせて `@libraz/formulon-cell-vue` または `@libraz/formulon-cell-react` を追加してください。詳しくは [formulon-cell のインストール](/ja/cell/install) を参照してください。

## ソースから

このドキュメントが対象とするタグをチェックアウトしてビルドします。

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
git checkout v0.15.2
make build
make test
```

`make build` はデバッグビルドの CLI を `build/bin/formulon_cli` に生成します。WASM、Python、Native Node のバインディングには個別のビルドターゲットがあります。手順は [ソースからビルド](/ja/development/build-from-source)、`.node` アドオンの配置は [Native Node 連携](/ja/runtimes/node-native) を参照してください。
