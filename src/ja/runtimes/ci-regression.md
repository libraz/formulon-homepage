# CI 回帰検査

スプレッドシート出力が製品契約の一部になっているとき、Formulon は CI で力を発揮します。数式の編集や計算値の変化が明示的な diff として PR レビューに現れ、レビュアーが分類できる形になります。

::: info 用語: parity runner
リポジトリ内テストランナー。共有 fixture を WASM / Native Node / Python / CLI など利用可能な全 channel で評価し、*missing*（binding がビルドされていない）と *mismatched*（channel 間で値が違う）を区別して報告します。`make parity-test` で実行。
:::

## 数式スナップショット

```sh
formulon dump --formulas model.xlsx > model.formulas.txt
git diff --exit-code model.formulas.txt
```

cached value に依存せずに数式編集を検知します。再計算なしで動くため安価で、PR ごとに走らせても問題ありません。

## 計算値スナップショット

```sh
formulon recalc model.xlsx -o /tmp/model.recalc.xlsx --quiet
formulon dump --values /tmp/model.recalc.xlsx > model.values.txt
git diff --exit-code model.values.txt
```

golden 比較に使えます。`dump --values` は事前に再計算し、安定順序ですべての非空セルを出力します。「数式の変更」と「計算値の変化」両方を見たいときは数式スナップショットと組にして使います。

## パッケージ間の整合性検査

リポジトリには parity runner があります。

```sh
make parity-test
```

利用可能な channel で共有 fixture を評価し、missing と mismatched を分けて報告します。binding やパッケージングを変更したときに有効です。

::: tip parity と oracle の違い
parity runner は *自分たちの* surface 同士が一致していることを検査します。[Oracle テスト](/ja/compatibility/oracle-testing) は *Excel と* 一致していることを検査します。両方必要です ─ parity は素早い事前チェック、oracle は互換性の根拠です。
:::

## CI スナップショットに向かないとき

`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` のような volatile 関数を含む数式は、fixture 側で揺らぎを制御または明文化しない限り、直接スナップショットには向きません。外部サービス依存（web / cube）も CI runner ごとに異なる結果が出る可能性があります。

そうしたワークブックでは数式のみスナップショット（`dump --formulas`）し、代表セルの値は「範囲 / 形状の assertion」で検査するスクリプトに分けると安定します。

## 次に読むもの

- [CI でワークブック回帰検査（シナリオ）](/ja/scenarios/ci-regression) ─ end-to-end パイプライン例
- [CLI ワークフロー](/ja/runtimes/cli) ─ スナップショットの裏で動くコマンド
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ 互換性の根拠
