# CI 回帰検査

スプレッドシートの出力がプロダクトの仕様の一部なら、Formulon を CI に組み込めます。数式の編集や計算値の変化が diff として PR に現れるため、レビュアーが意図した変更かどうかを判断できます。

::: info 用語: パッケージ間の整合性検査ランナー
Formulon のソースリポジトリにあるテストランナーです。共有の検証用ワークブックを、ビルド済みのすべてのチャネル（CLI、npm の WASM パッケージ、Python wheel）で評価します。*missing*（ビルドされていない）と *mismatched*（チャネル間で値が違う）を分けて報告し、使えるチャネルが 2 つ未満なら終了コード 77 で検査をスキップします。`make parity-test` で実行します。Native Node は対象外です。
:::

## 数式スナップショット

`model.formulas.txt` と `model.values.txt` をリポジトリ内に作成してコミットしてから、この検査を有効にしてください。`git diff` は未追跡ファイルを比較しません。CI では `git ls-files --error-unmatch model.formulas.txt model.values.txt` で期待値ファイルの存在を先に確認できます。

```sh
formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --formulas model.xlsx > model.formulas.txt
git diff --exit-code model.formulas.txt
```

キャッシュ値に依存せずに数式編集を検知します。再計算なしで動くため安価で、PR ごとに走らせても問題ありません。

## 計算値スナップショット

```sh
formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --values model.xlsx > model.values.txt
git diff --exit-code model.values.txt
```

期待値比較に使えます。`dump --values` は事前に再計算し、安定順序ですべての非空セルを出力します。「数式の変更」と「計算値の変化」両方を見たいときは数式スナップショットと組にして使います。

## パッケージ間の整合性検査 {#package-parity}

リポジトリにはパッケージ間の整合性検査ランナーがあります。

```sh
make parity-test
```

`cli` / `npm`（WASM）/ `python` の各チャネルで共有の検証用ワークブックを評価し、未ビルドと値の不一致を分けて報告します。バインディングやパッケージングを変更したときに有効です。

::: tip 整合性検査と Oracle テストの違い
パッケージ間の整合性検査は *自分たちの* 実行入口同士が一致していることを検査します。[Oracle テスト](/ja/compatibility/oracle-testing) は *Excel と* 一致していることを検査します。どちらも役立ちます。整合性検査はコミット前の素早い確認、Oracle テストは互換性の根拠です。
:::

<DiagramLayers :layers="[
  { title: '入力', nodes: ['共有の検証用ワークブック'] },
  { title: '検証トラック', nodes: [
    { label: '整合性検査ランナー', note: 'WASM / Python / CLI を比較' },
    { label: 'Oracle テスト', note: '共有エンジンと Excel から取得した期待値を比較' }
  ] },
  { title: '答える問い', nodes: [
    { label: '自分たちの実行入口同士が一致するか' },
    { label: 'Excel の正解と一致するか' }
  ] }
]" />

## CI スナップショットに向かないとき

`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` のような揮発性関数を含む数式は、検証データ側で揺らぎを制御または明文化しない限り、直接スナップショットには向きません。`WEBSERVICE`、CUBE 関数、`STOCKHISTORY` など外部サービス依存の関数は、このエンジンではネットワークへアクセスせず、利用不可を表す固定の Excel エラーを返します。[数式カバレッジ](/ja/compatibility/formula-coverage) の一覧を確認し、そのエラーを互換性上の仕様として記録するか、対象セルを除外してください。

そうしたワークブックでは数式のみスナップショット（`dump --formulas`）し、代表セルの値は、正確な値ではなく範囲や形を検証するスクリプトに分けると安定します。固定した `--profile` と `--now` によりロケールと時計の入力も明示できます。時計の指定は数式だけの出力には影響しません。

## 次に読むもの

- [CI でワークブックの回帰を検出（シナリオ）](/ja/scenarios/ci-regression) ─ 一連のパイプライン例
- [CLI ワークフロー](/ja/runtimes/cli) ─ スナップショットの裏で動くコマンド
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ 互換性の根拠
