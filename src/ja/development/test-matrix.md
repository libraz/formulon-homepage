# テストマトリクス

テストの面は `make test` 1 つではありません。Formulon は 1 ソースツリーから複数パッケージを出荷するため、層（core / oracle / packaging / parity）ごとに異なる種類の回帰を捕えます。

::: info 用語: CTest labels
CTest はテストにテキストラベル（`SLOW` / `LOAD` / `VARIANT` など）を付け、ラベルで include / exclude できます。pre-commit では遅いテストを除外し、CI ではそれらも回す、という運用が可能です。
:::

```mermaid
flowchart TB
  subgraph Core["Core ─ コア回帰を検出"]
    CT[make test<br/>fast CTest]
    CTA[make test-all<br/>SLOW / LOAD 含む]
  end
  subgraph Oracle["Oracle ─ Excel 差分を検出"]
    OV[make oracle-verify<br/>Excel JSON との比較]
    VAR[VARIANT テスト<br/>FORMULON_ORACLE_VARIANTS=ON]
  end
  subgraph Packaging["Packaging ─ binding 回帰を検出"]
    WASM[WASM:<br/>make wasm / test-wasm / npm-test]
    PY[Python:<br/>make python-test]
    NN[Native Node:<br/>make node-test]
    CLI[CLI:<br/>tests/cli CTest target]
  end
  subgraph Parity["Parity ─ surface 間ずれを検出"]
    P[make parity-test<br/>surface 横断の一致]
  end
  Core --> Oracle --> Packaging --> Parity
```

## Core テスト

```sh
make build
make test
make test-slow
make test-all
```

`make test` は `SLOW` と `LOAD` ラベルを除外します。`make test-all` は最も広い CTest セット。commit 前に `make test`、core を触る PR を出す前に `make test-all`。

## Oracle テスト

```sh
make oracle-verify
```

oracle verification は Excel から取得済みの JSON と Formulon 出力を比較します。Excel を起動しないので CI でも安全です。

variant oracle テストは opt-in:

```sh
cmake -B build -DFORMULON_ORACLE_VARIANTS=ON
cmake --build build --target formulon_oracle_variant_tests
cd build && ctest -L VARIANT --output-on-failure
```

profile 固有差分の調査や、新 profile を追加する前に使います。

## パッケージング smoke test

| surface | コマンド |
| --- | --- |
| WASM | `make wasm`、`make test-wasm`、`make npm-test` |
| Python | `make python-test` |
| Native Node | `make node-test` |
| CLI | `tests/cli` 配下の CTest target |

各 binding の `load → mutate → recalc → save` ループが core 変更後も成立することを確認します。

## Surface 間の parity

```sh
make parity-test
```

parity runner は利用可能 channel すべてで共有 fixture を評価し、2 つ以上の surface が食い違ったら mismatch を報告します。未ビルドの channel は failure ではなく *missing* として扱われるので、Emscripten / Excel / 特定 toolchain を持たないマシンからも contribute できます。

::: tip parity と oracle の違いを 1 行で
parity = 自分たちの surface 同士が一致している。oracle = 自分たちが Excel と一致している。リリース前には両方の signal が必要です。
:::

## 診断

| コマンド | 目的 |
| --- | --- |
| `RegistryCatalog.CoverageReport` | 正規カタログに対する実行時の関数登録状態 |
| `make behavior-status` | behavior vocabulary の status |
| `make coverage` | ローカル coverage 診断 |
| `make mutation` | ローカル mutation testing 診断 |

## 次に読むもの

- [ソースからビルド](/ja/development/build-from-source) ─ テスト対象のビルド方法
- [Oracle 提供](/ja/development/oracle-contribution) ─ `oracle-verify` が消費するデータ
- [リリースチェックリスト](/ja/development/release-checklist) ─ 各テストがリリース時いつ走るか
