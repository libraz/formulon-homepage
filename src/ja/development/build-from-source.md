# ソースからビルド

ほとんどのコントリビュータが必要とするのは `make build` と `make test` だけです。それ以外のターゲットは実行環境固有の作業（WASM / Python / Native Node）とリリース時のステージングに使います。

::: info 用語: ステージング
ビルド成果物を各実行環境のパッケージレイアウトへ配置する作業（ステージング）です。`packages/npm/dist/`、`packages/python/formulon/_wasm/`、Native Node アドオン用ディレクトリなどが対象です。`npm test`、`unittest`、`node --test` がビルドしたばかりのコアに届くようにします。
:::

リポジトリを取得します。

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
```

ネイティブビルドには CMake と C++17 のコンパイラが必要です。WASM ビルドには `tools/wasm/emsdk-version.txt` で固定している Emscripten SDK が必要です。npm パッケージには Node 22 以降が必要です。サイズ検査を完全に実行するには `brotli` もインストールしてください。

## ネイティブのデバッグビルド

```sh
make build
make test
```

`build/` を CMake で構成し、高速な CTest 一式を実行します。`make test` は `SLOW`・`BENCH`・`TSAN` ラベルを除外します。`make test-slow` は `SLOW` を含め、`BENCH`・`TSAN` は除外します。`make test-all` は現在のビルド設定で有効なテストをすべて実行します。コア変更の多くはこのループで確認できます。

## リリースビルド

```sh
make release
```

性能測定や成果物出荷の前に使います。デバッグビルドは余分なアサーションが入り、計測値が歪みます。

## WASM パッケージ

固定した [Emscripten](https://emscripten.org/) SDK と Node 22 以降が必要です。

```sh
make wasm
make wasm-threads
make test-wasm
make npm-package
make npm-check-dts
make npm-test
make npm-pack
make size-check
```

`make wasm` は単一スレッドの `formulon.js` / `formulon.wasm` を `build-wasm/` にビルドします。`make wasm-threads` は pthread 版の `formulon_threads.js` / `formulon_threads.wasm` を `build-wasm-threads/` にビルドします。`make test-wasm` は両方のビルドに対してスモークテスト（主要操作の動作確認）を実行します。`make npm-package` は両ビルド、入口用の補助モジュール、`formulon.d.ts` を `packages/npm/dist/` に配置します。既定入口は `@libraz/formulon`、pthread 入口は `@libraz/formulon/threads` です。`make npm-check-dts` は配置済みの宣言とソース宣言を比較し、`make npm-test` は両方の配置済み入口を検証します。`make size-check` は両方の WASM バイナリに [サイズ上限](/ja/development/size-budgets) を適用します。

## Python パッケージ

CMake、Python 3.9 以降、setuptools、wheel、固定した [Emscripten](https://emscripten.org/) SDK、そして `wasmtime` ランタイムが必要です。`make python-package` は組み込み用 `formulon_capi.wasm` を `emcmake` でビルドする `wasm-capi` ターゲットに依存します。

```sh
python3 -m venv .venv-python
. .venv-python/bin/activate
python -m pip install 'wasmtime>=49,<50' setuptools wheel
make PYTHON=python python-package python-test python-wheel
```

wheel は `formulon_capi.wasm` を `packages/python/formulon/_wasm/` に配置し、`py3-none-any` パッケージとしてビルドします。`wasmtime` はローカルテストに必要で、wheel のインストール時にはプラットフォーム固有のランタイムとして解決されます。インストール時にネイティブコンパイラは不要です。

## Native Node パッケージ

```sh
make NODE_NATIVE_BUILD_DIR=build-node-native node-test
```

アドオンをビルドし、パッケージレイアウトへ配置し、`node --test` で N-API テストスイートを実行します。ネイティブアドオンは別ディレクトリでビルドし、コアのデバッグ設定を `build/` に残します。ビルド済みバイナリは CI から `(os, arch)` 別に公開されており、ローカルのターゲットは主に開発用です。

## Oracle ツール群

Oracle データ生成は Excel とホスト固有のセットアップが必要です。

```sh
make oracle-setup
make oracle-gen
make oracle-verify
```

CI 検証はコミット済みのゴールデンデータを読むだけで、Excel は起動しません。コントリビュータ向けフローは [Oracle データの提供](/ja/development/oracle-contribution) を参照してください。

::: tip 変更に必要なビルドとテストを選ぶ
数式評価器だけ触るコントリビュータは通常 `make build && make test` で十分です。WASM パッケージングを変更する場合は `make wasm && make npm-test && make size-check` が必要です。すべてのターゲットが必要になる変更は多くありません。
:::

## 次に読むもの

- [テストマトリクス](/ja/development/test-matrix) ─ どのテストターゲットが何を検出するか
- [サイズ上限](/ja/development/size-budgets) ─ `size-check` が強制する上限
- [リリースチェックリスト](/ja/development/release-checklist) ─ リリース前に走らせる内容
