# CI でワークブックの回帰を検出

CLI を使い、ワークブックの変更をコードレビューで確認するパターンです。Excel ファイルをそのまま比較しても、数式や値の変更は読み取れません。Formulon で数式や値をテキストに出力すると、レビュアーが読める差分になります。

::: warning 揮発性数式に注意
`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` を含むワークブックでは、計算のたびに値が変わる可能性があります。入力を固定値に置き換える、変動する条件と比較方法を決める、値の比較対象から外す、などの方法を選んでください。
:::

::: info 用語: 期待値ファイル
期待する出力としてコミットされているファイルです。テストは今回の出力と比較し、差があれば失敗します。レビュアーが意図的な変更（期待値を更新する）か回帰（コードやワークブックを修正する）かを判断します。
:::

## パイプラインの形

<DiagramLayers
  :layers="[
    { nodes: ['プルリクエスト'] },
    { nodes: ['CI ジョブ'] },
    { nodes: [
      { label: 'formulon dump --formulas', note: '数式スナップショット' },
      { label: 'formulon recalc → formulon dump --values', note: '値スナップショット' }
    ] },
    { nodes: ['testdata/*.txt'] },
    { nodes: ['git diff --exit-code'] },
    { nodes: [
      { label: '差分なし → 成功', note: '' },
      { label: 'ドリフト → レビュアーが分類', note: '想定 / 互換 / バグ' }
    ] }
  ]"
  label="パイプラインの形。プルリクエストが CI ジョブを起動し、数式スナップショットと再計算後の値スナップショットの両方を取得して testdata に書き込み、git で差分を取る。差分なしなら成功、差分があればレビュアーが分類する"
/>

数式・値のスナップショットを取る基本コマンド（`formulon dump --formulas`、`formulon dump --values`）は [CI 回帰検査](/ja/runtimes/ci-regression) で説明しているものと同じです。具体的な呼び出し方や、揮発性数式でスナップショットを避けるべき場面についてはそちらを参照してください。このページでは、それらを PR パイプラインに組み込む方法と、ドリフトのレビュー方針を扱います。

ジョブを有効にする前に、期待値ファイルを作成してコミットしてください。`git diff` は未追跡ファイルを比較しないため、`git ls-files --error-unmatch testdata/model.formulas.txt testdata/model.values.txt` で先に確認します。

Formulon のソースを取得した環境では、プッシュ前に `make parity-test` で補助的な検査もできます。利用可能なチャネル（`cli`、`npm`（WASM）、`python`）で共通の検証用ワークブックを評価し、チャネル間の不一致を報告します。上の CI ジョブでは検出できない、パッケージ間の差を確認できます。詳しくは [CI 回帰検査](/ja/runtimes/ci-regression#package-parity) を参照してください。

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
      - name: Install formulon CLI
        run: |
          curl -L -o formulon.tar.gz "https://github.com/libraz/formulon/releases/download/v0.12.0/formulon-0.12.0-linux-x64.tar.gz"
          tar -xzf formulon.tar.gz --strip-components=1
          chmod +x formulon
          sudo mv formulon /usr/local/bin/
      - name: Snapshot formulas
        run: |
          formulon dump --formulas model.xlsx > testdata/model.formulas.txt
      - name: Snapshot values
        run: |
          formulon dump --values model.xlsx > testdata/model.values.txt
      - name: Fail on diff
        run: |
          git diff --exit-code testdata/
```

揮発性の入力を固定し、ワークブックのプロファイルと Formulon のエンジンバージョンをそろえると、スナップショットの差分をワークブックやエンジンの変更として確認できます。アップグレードで出力が意図的に変わる場合もあるため、固定したバージョン自体もレビューしてください。

## レビュー方針

差分は次のいずれかに分類してください。

- 想定済みの数式編集
- 想定済みの入力変更
- Formulon の互換性差分
- Excel の挙動変化
- バグ

この分類を PR 本文（またはコミット末尾の注記）に書き残すと、将来同じ差分を見た人が「なぜ受け入れたのか」を追跡できます。期待値ファイルが意味の分からないバイナリ差分になるのを防ぎます。

::: tip CI では Formulon バージョンを固定する
Formulon のバージョン（または CLI バイナリ URL）を明示的に固定してください。エンジンを更新すると数式やファイル形式の挙動が意図的に変わる場合があるため、パッチリリースでも出力互換を前提にしません。
:::

## 次に読むもの

- [CLI ワークフロー](/ja/runtimes/cli) ─ このシナリオの裏で動くコマンド
- [CI 回帰検査](/ja/runtimes/ci-regression) ─ より広いパターン
- [互換性モデル](/ja/compatibility/model) ─ プロファイルを固定する理由
