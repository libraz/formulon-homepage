# ソースからビルド

ほとんどの contributor が必要とするのは `make build` と `make test` だけです。それ以外の target は surface 固有の作業（WASM / Python / Native Node）とリリース時の staging 用です。

::: info 用語: staging
ビルド成果物を各 surface のパッケージレイアウトへコピーすること ─ `packages/npm/dist/`、`packages/python/formulon/_wasm/`、Native Node アドオン用ディレクトリなど。`npm test` / `pytest` / `node -e '…'` が build したばかりの core に届くようにするのが staging の役割です。
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

`build/` を CMake で構成し、`SLOW` / `LOAD` ラベルを除いた fast CTest suite を実行します。core 変更のほぼすべてはこのループで回せます。

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

`make npm-package` は `formulon.js` / `formulon.wasm` / `formulon.d.ts` を `packages/npm/dist/` に stage します。`make size-check` が [サイズ予算](/ja/development/size-budgets) を強制するので、コードを増やしうる変更の前に必ず通してください。

## Python パッケージ

CMake、Python 3.9+、setuptools、wheel が必要です。

```sh
make python-package
make python-test
make python-wheel
```

wheel は `formulon_capi.wasm` を `packages/python/formulon/_wasm/` に stage し、`py3-none-any` パッケージとしてビルドします。プラットフォーム固有 runtime は install 時に `wasmtime` wheel として解決されます。install 時にネイティブコンパイラは不要です。

## Native Node パッケージ

```sh
make node-native
make node-package
make node-test
```

N-API アドオンを build / stage / smoke test します。prebuilt は CI から `(os, arch)` 別に公開されており、ローカル target は主に開発用です。

## Oracle ツール群

oracle 生成は Excel と host-specific setup が必要です。

```sh
make oracle-setup
make oracle-gen
make oracle-verify
```

CI 検証は committed golden を読むだけで、Excel は起動しません。contributor 向けフローは [Oracle 提供](/ja/development/oracle-contribution) を参照。

::: tip 必要最小限の集合を選ぶ
formula evaluator だけ触る contributor は通常 `make build && make test` で十分。WASM packaging だけ触るなら `make wasm && make npm-test && make size-check`。全 target を回す変更はそれほど多くありません。
:::

## 次に読むもの

- [テストマトリクス](/ja/development/test-matrix) ─ どのテスト target が何を捕えるか
- [サイズ予算](/ja/development/size-budgets) ─ `size-check` が強制する ceiling
- [リリースチェックリスト](/ja/development/release-checklist) ─ リリース前に走らせる内容
