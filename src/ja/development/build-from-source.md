# ソースからビルド

ほとんどのコントリビュータが必要とするのは `make build` と `make test` だけです。それ以外の target は実行入口固有の作業（WASM / Python / Native Node）とリリース時のステージング用です。

::: info 用語: staging
ビルド成果物を各実行入口のパッケージレイアウトへコピーすることです。`packages/npm/dist/`、`packages/python/formulon/_wasm/`、Native Node アドオン用ディレクトリなどが対象です。`npm test` / `pytest` / `node -e '...'` がビルドしたばかりのコアに届くようにするのがステージングの役割です。
:::

リポジトリを clone:

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
```

## ネイティブのデバッグビルド

```sh
make build
make test
```

`build/` を CMake で構成し、`SLOW` / `LOAD` ラベルを除いた高速な CTest 一式を実行します。コア変更のほぼすべてはこのループで回せます。

## リリースビルド

```sh
make release
```

性能測定や成果物出荷の前に使います。デバッグビルドは余分なアサーションが入り、計測値が歪みます。

## WASM パッケージ

[Emscripten](https://emscripten.org/) が必要です。

```sh
make wasm
make test-wasm
make npm-package
make npm-test
make npm-pack
make size-check
```

`make npm-package` は `formulon.js` / `formulon.wasm` / `formulon.d.ts` を `packages/npm/dist/` にステージします。`make size-check` が [サイズ予算](/ja/development/size-budgets) を強制するので、コードを増やしうる変更の前に必ず通してください。

## Python パッケージ

CMake、Python 3.9+、setuptools、wheel、そして [Emscripten](https://emscripten.org/) が必要です ─ `make python-package` は組み込み用 `formulon_capi.wasm` を `emcmake` でビルドする `wasm-capi` target に依存します。

```sh
make python-package
make python-test
make python-wheel
```

wheel は `formulon_capi.wasm` を `packages/python/formulon/_wasm/` にステージし、`py3-none-any` パッケージとしてビルドします。プラットフォーム固有ランタイムはインストール時に `wasmtime` wheel として解決されます。インストール時にネイティブコンパイラは不要です。

## Native Node パッケージ

```sh
make node-native
make node-package
make node-test
```

アドオンをビルドし（`node-native`）、パッケージレイアウトへステージし（`node-package`）、`node --test` で N-API テストスイートを実行します（`node-test`）。ビルド済みバイナリは CI から `(os, arch)` 別に公開されており、ローカル target は主に開発用です。

## Oracle ツール群

Oracle データ生成は Excel とホスト固有のセットアップが必要です。

```sh
make oracle-setup
make oracle-gen
make oracle-verify
```

CI 検証はコミット済みのゴールデンデータを読むだけで、Excel は起動しません。コントリビュータ向けフローは [Oracle 提供](/ja/development/oracle-contribution) を参照。

::: tip 必要最小限の集合を選ぶ
数式評価器だけ触るコントリビュータは通常 `make build && make test` で十分です。WASM パッケージングだけ触るなら `make wasm && make npm-test && make size-check`。全 target を回す変更はそれほど多くありません。
:::

## 次に読むもの

- [テストマトリクス](/ja/development/test-matrix) ─ どのテスト target が何を捕えるか
- [サイズ予算](/ja/development/size-budgets) ─ `size-check` が強制する上限
- [リリースチェックリスト](/ja/development/release-checklist) ─ リリース前に走らせる内容
