# 実行環境間の比較と Excel との比較

テストの対象範囲は `make test` 1 つに収まりません。Formulon は 1 つのソースツリーから複数パッケージを出荷するため、コア、Oracle、パッケージング、実行環境間の一致を別々に検証します。

::: info 用語: CTest のラベル
CTest はテストにテキストラベル（`SLOW` / `BENCH` / `TSAN` / `VARIANT` など）を付け、ラベルで対象に含める・除外する操作ができます。コミット前は遅いテストや診断用テストを除外し、CI ではそれらも実行できます。
:::

<DiagramLayers :layers="[
  { title: 'コア', nodes: [{ label: 'make test', note: 'SLOW / BENCH / TSAN を除外' }, { label: 'make test-all', note: '有効なテストをすべて実行' }] },
  { title: 'Oracle', nodes: [{ label: 'make oracle-verify', note: 'ゴールデンとの比較' }, { label: 'VARIANT テスト', note: 'FORMULON_ORACLE_VARIANTS=ON' }] },
  { title: 'パッケージング', nodes: [{ label: 'WASM', note: 'wasm / test-wasm / npm-test' }, { label: 'Python', note: 'python-test' }, { label: 'Native Node', note: 'node-test' }, { label: 'CLI', note: 'tests/cli の CTest ターゲット' }] },
  { title: '実行環境間の一致', nodes: [{ label: 'make parity-test', note: '利用可能な実行環境を比較' }] }
]" />

## コアテスト

```sh
make build
make test
make test-slow
make test-all
```

`make test` は `SLOW`・`BENCH`・`TSAN` ラベルを除外します。`make test-slow` は `SLOW` を含め、`BENCH`・`TSAN` は除外します。`make test-all` は現在のビルド設定で有効なテストをすべて実行します。コミット前に `make test`、コアを変更する PR の前に `make test-all` を実行します。

## Oracle テスト

```sh
make oracle-verify
```

Oracle 検証は Excel 由来のゴールデンデータと Formulon 出力を比較します。Excel を起動しないので CI でも安全です。

バリアント Oracle テストは明示的に有効化します。

```sh
cmake -B build-variants -DCMAKE_BUILD_TYPE=Debug -DFORMULON_ORACLE_VARIANTS=ON
cmake --build build-variants --target formulon_oracle_variant_tests formulon_workbook_oracle_variant_tests --parallel
ctest --test-dir build-variants -L VARIANT --output-on-failure
```

検証済みの取得元情報があるバリアントだけが対象です。オプションを有効にしても、取得済みデータがすべて自動的にテスト対象になるわけではありません。プロファイル固有差分の調査や、対応するプロファイルを追加する前に使います。

## パッケージングのスモークテスト

| 実行環境 | コマンド |
| --- | --- |
| WASM | `make wasm`、`make test-wasm`、`make npm-test` |
| Python | `make python-test` |
| Native Node | `make node-test` |
| CLI | `tests/cli` 配下の CTest ターゲット |

各バインディングの `load → mutate → recalc → save` ループがコア変更後も成立することを確認します。ホスト側の値変換とリソースの寿命も検証します。

## 実行環境間の一致

```sh
make parity-test
```

一致を検証するツールは、ローカルで利用できる CLI・npm WASM・Python の実行環境を比較します。利用できない実行環境はスキップします。比較には 2 つ以上の実行環境が必要で、足りない場合は終了コード 77 を返すため、`make` は正常終了しません。結果の不一致、評価エラー、検証用データの期待値との不一致で失敗します。Native Node、pthread 版 npm 入口、MCP、セル UI は別途検証します。

::: tip パリティと Oracle の違い
パリティは利用可能な実行環境同士の一致を確認します。Oracle はコアと Excel の一致を確認します。リリース前には両方の結果が必要です。
:::

## 診断

| コマンド | 目的 |
| --- | --- |
| `ctest -R RegistryCatalog.CoverageReport -V --output-on-failure`（`make build` の後、build ディレクトリで実行） | 正規カタログに対する実行時の関数登録状態 |
| `make behavior-status` | 細かな挙動のカタログの状態 |
| `make coverage` | ローカルカバレッジ診断 |
| `make mutation` | ローカルミューテーションテスト診断 |

`RegistryCatalog.CoverageReport` は診断専用の gtest ケースです ─ 常に成功し、カバレッジ比率を標準出力に出すだけで、それは `ctest -V` を付けたときだけ表示されます。合否ゲートではなく、現在の数値を読むための手段として扱ってください。

## 追加の診断

| ターゲット | 目的 |
| --- | --- |
| `make ironcalc-verify` | IronCalc 由来の二次 Oracle 検証データを検証します |
| `make fuzz` / `make fuzz-long` | パーサ、評価器、ファイル形式、印刷設定のファジングハーネスを実行します |
| `bash tools/ci/run_tsan.sh` | CI で使う ThreadSanitizer テストを実行します |

## 次に読むもの

- [ソースからビルド](/ja/development/build-from-source) ─ テスト対象のビルド方法
- [Oracle データの提供](/ja/development/oracle-contribution) ─ `oracle-verify` が消費するデータ
- [リリースチェックリスト](/ja/development/release-checklist) ─ リリース時に各テストを実行する時期
