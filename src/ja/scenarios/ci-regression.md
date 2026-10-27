# CI でワークブックの回帰を検出

CLI を使い、ワークブックの変更をコードレビューで確認するパターンです。Excel ファイルをそのまま比較しても、数式や値の変更は読み取れません。Formulon で数式や値をテキストに出力すると、レビュアーが読める差分になります。スプレッドシートの出力がプロダクトの仕様の一部になっている場合に役立ちます。

::: info 用語: 期待値ファイル
期待する出力としてコミットされているファイルです。テストは今回の出力と比較し、差があれば失敗します。レビュアーが意図的な変更（期待値を更新する）か回帰（コードやワークブックを修正する）かを判断します。
:::

## パイプラインの形

<DiagramLayers
  :layers="[
    { nodes: [{ label: 'プルリクエスト', note: 'ワークブックかエンジンの変更' }] },
    { nodes: [
      { label: 'formulon dump --formulas', note: '数式スナップショット（再計算なし）' },
      { label: 'formulon dump --values', note: '再計算してから値スナップショット' }
    ] },
    { nodes: [{ label: 'git diff --exit-code', note: 'コミット済みの testdata/*.txt と比較' }] },
    { nodes: [
      { label: '差分なし', note: 'ジョブは成功' },
      { label: '差分あり', note: 'レビュアーが差分を分類', tone: 'alt' }
    ] }
  ]"
  label="パイプラインの形。プルリクエストで数式スナップショットと再計算後の値スナップショットを取り、コミット済みのテキストファイルと比較する。差分がなければ成功し、差分があればレビュアーが分類する"
  caption="どちらのスナップショットもテキストなので、ワークブックの変更は読める差分としてレビューに届きます。"
/>

ジョブを有効にする前に、期待値ファイルを作成してコミットしてください。`git diff` は未追跡ファイルを比較しないため、`git ls-files --error-unmatch testdata/model.formulas.txt testdata/model.values.txt` で先に確認します。

## 数式スナップショット

```sh
formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --formulas model.xlsx > testdata/model.formulas.txt
git diff --exit-code testdata/model.formulas.txt
```

キャッシュ値に依存せずに数式の編集を検知します。再計算しないので軽く、PR ごとに実行できます。

## 計算値スナップショット

```sh
formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --values model.xlsx > testdata/model.values.txt
git diff --exit-code testdata/model.values.txt
```

`dump --values` は先に再計算し、空でないセルをすべて、シートとセルの安定した順序で出力します。数式の変更と計算値の変化の両方を見たいときは、数式スナップショットと組にして使います。

## GitHub Actions 例

```yaml
name: workbook regression
on: [pull_request]
jobs:
  workbook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: コミット済み期待値を確認
        run: git ls-files --error-unmatch testdata/model.formulas.txt testdata/model.values.txt
      - name: 固定したバージョンの Formulon CLI を入れる
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release download v0.18.0 --repo libraz/formulon \
            --pattern 'formulon-0.18.0-linux-x64.tar.gz*' --dir "$RUNNER_TEMP"
          cd "$RUNNER_TEMP"
          sha256sum -c formulon-0.18.0-linux-x64.tar.gz.sha256
          tar -xzf formulon-0.18.0-linux-x64.tar.gz
          echo "$RUNNER_TEMP/formulon-0.18.0-linux-x64" >> "$GITHUB_PATH"
      - name: Snapshot formulas
        run: |
          formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --formulas model.xlsx > testdata/model.formulas.txt
      - name: Snapshot values
        run: |
          formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --values model.xlsx > testdata/model.values.txt
      - name: Fail on diff
        run: |
          git diff --exit-code testdata/
```

`dump --values` は出力の前に再計算するため、別途 `recalc` を実行する必要はありません。`--profile` と `--now` を明示するのは、どちらもワークブックに保存されないためです。揮発性の入力を固定し、プロファイル、時刻、CLI のバージョンをそろえると、スナップショットの差分はワークブックかエンジンの変更を示します。

::: tip CI では Formulon のバージョンを固定する
例のように、リリースタグを明示的に固定してください。エンジンを更新すると数式やファイル形式の挙動が意図的に変わる場合があるため、パッチリリースでも出力互換を前提にしません。タグの更新は単独のプルリクエストにすると、それによるスナップショットの差分だけをレビューできます。
:::

## レビュー方針

差分は次のいずれかに分類してください。

- 想定済みの数式編集
- 想定済みの入力変更
- Formulon の互換性差分
- Excel の挙動変化
- バグ

この分類を PR 本文（またはコミット末尾の注記）に書き残すと、将来同じ差分を見た人が「なぜ受け入れたのか」を追跡できます。期待値ファイルが意味の分からないバイナリ差分になるのを防ぎます。

## 揮発性関数と外部サービス依存の関数

`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` を制御せずに含むワークブックは、値スナップショットに向きません。検証データ側で値を固定するか、揺らぎを明記するか、値の比較対象から外してください。`WEBSERVICE`、CUBE 関数、`STOCKHISTORY` など外部サービス依存の関数は、このエンジンではネットワークへアクセスせず、利用不可を表す固定の Excel エラーを返します。[数式カバレッジ](/ja/compatibility/formula-coverage) の一覧を確認し、そのエラーを互換性上の仕様として記録するか、対象セルを除外してください。

揮発性関数の多いワークブックでは数式だけをスナップショットし（`dump --formulas`）、代表セルの値は、正確な値ではなく範囲や形を検証するスクリプトで確かめると安定します。`--profile` と `--now` を固定すれば、ロケールと時計の入力もコマンド上で明示できます。時計の指定は数式だけの出力には影響しません。

## パッケージ間の整合性検査 {#compare-package-surfaces}

Formulon のソースを取得した環境では、プッシュ前に `make parity-test` で素早く検査できます。上の CI ジョブでは検出できない、同じワークブックに対するパッケージ間の食い違いを見つけます。

::: info 用語: パッケージ間の整合性検査ランナー
Formulon のソースリポジトリにあるテストランナーです。共有の検証用ワークブックを、ビルド済みのすべてのチャネル（CLI、npm の WASM パッケージ、Python wheel）で評価します。*missing*（ビルドされていない）と *mismatched*（チャネル間で値が違う）を分けて報告し、使えるチャネルが 2 つ未満なら終了コード 77 で検査をスキップします。Native Node は対象外です。
:::

<DiagramLayers :layers="[
  { title: '入力', nodes: [{ label: '共有の検証用ワークブック', note: '全チャネルで同じもの' }] },
  { title: '検証トラック', nodes: [
    { label: '整合性検査ランナー', note: 'WASM / Python / CLI を比較' },
    { label: 'Oracle テスト', note: 'エンジンと Excel の取得値を比較', tone: 'alt' }
  ] },
  { title: '答える問い', nodes: [
    { label: '実行入口同士が一致するか', note: 'コミット前の素早い確認' },
    { label: 'Excel と一致するか', note: '互換性の根拠', tone: 'alt' }
  ] }
]" caption="整合性検査は Formulon 同士を比べ、Excel と比べるのは Oracle テストだけです。" />

バインディングやパッケージングを変更したときに整合性検査を使ってください。Excel との一致を確かめるのは、別の仕組みの [Oracle テスト](/ja/compatibility/oracle-testing) です。

## 次に読むもの

- [CLI ワークフロー](/ja/runtimes/cli) ─ このシナリオの裏で動くコマンド
- [互換性モデル](/ja/compatibility/model) ─ プロファイルを固定する理由
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ 互換性の根拠
