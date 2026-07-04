# CI 回帰検査

スプレッドシート出力がプロダクトの重要な成果物になっているとき、Formulon は CI で力を発揮します。数式の編集や計算値の変化が明示的な diff として PR レビューに現れ、レビュアーが分類できる形になります。

::: info 用語: parity runner
リポジトリ内テストランナーです。共有の検証用ワークブックを WASM / Python / CLI など利用可能な全実行入口で評価し、*missing*（バインディングがビルドされていない）と *mismatched*（実行入口間で値が違う）を区別して報告します。`make parity-test` で実行。Native Node はまだ parity runner に組み込まれておらず、比較対象のチャネルがありません。
:::

## 数式スナップショット

```sh
formulon dump --formulas model.xlsx > model.formulas.txt
git diff --exit-code model.formulas.txt
```

キャッシュ値に依存せずに数式編集を検知します。再計算なしで動くため安価で、PR ごとに走らせても問題ありません。

## 計算値スナップショット

```sh
formulon recalc model.xlsx -o /tmp/model.recalc.xlsx --quiet
formulon dump --values /tmp/model.recalc.xlsx > model.values.txt
git diff --exit-code model.values.txt
```

期待値比較に使えます。`dump --values` は事前に再計算し、安定順序ですべての非空セルを出力します。「数式の変更」と「計算値の変化」両方を見たいときは数式スナップショットと組にして使います。

## パッケージ間の整合性検査

リポジトリには parity runner があります。

```sh
make parity-test
```

`cli` / `npm`（WASM）/ `python` の各チャネルで共有の検証用ワークブックを評価し、missing と mismatched を分けて報告します。バインディングやパッケージングを変更したときに有効です。

::: tip parity と oracle の違い
parity runner は *自分たちの* 実行入口同士が一致していることを検査します。[Oracle テスト](/ja/compatibility/oracle-testing) は *Excel と* 一致していることを検査します。両方必要です。parity は素早い事前チェック、Oracle テストは互換性の根拠です。
:::

<DiagramLayers :layers="[
  { title: '入力', nodes: ['共有の検証用ワークブック'] },
  { title: '検証トラック', nodes: [
    { label: 'Parity runner', note: 'WASM vs Python vs CLI' },
    { label: 'Oracle テスト', note: '任意のチャネル vs 実際の Excel' }
  ] },
  { title: '答える問い', nodes: [
    { label: '自分たちの実行入口同士が一致するか' },
    { label: 'Excel の正解と一致するか' }
  ] }
]" />

## CI スナップショットに向かないとき

`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` のような揮発性関数を含む数式は、検証データ側で揺らぎを制御または明文化しない限り、直接スナップショットには向きません。外部サービス依存（web / cube）も CI runner ごとに異なる結果が出る可能性があります。

そうしたワークブックでは数式のみスナップショット（`dump --formulas`）し、代表セルの値は「範囲 / 形状の assertion」で検査するスクリプトに分けると安定します。

## 次に読むもの

- [CI でワークブックの回帰を検出（シナリオ）](/ja/scenarios/ci-regression) ─ end-to-end パイプライン例
- [CLI ワークフロー](/ja/runtimes/cli) ─ スナップショットの裏で動くコマンド
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ 互換性の根拠
