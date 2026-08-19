# CI でワークブックの回帰を検出

CLI を使い、ワークブックの変更をコードレビューで可視化するパターンです。手で Excel 編集されたワークブックはバイナリとして不透明ですが、Formulon にかけるとレビュアーが読める差分になります。

::: warning 揮発性数式に注意
`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` を含むワークブックは値スナップショットに向きません。隔離、明文化、またはスナップショット対象外にしてください。
:::

::: info 用語: 期待値ファイル
期待出力としてコミットされているファイルです。テストは現在出力と比較し、ずれていれば失敗します。レビュアーが意図的変更（期待値更新）か回帰（コード / ワークブックの修正）か判断します。
:::

## パイプラインの形

<DiagramLayers
  :layers="[
    { nodes: ['Pull request'] },
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
  label="パイプラインの形。Pull request が CI ジョブを起動し、数式スナップショットと再計算後の値スナップショットの両方を取得して testdata に書き込み、git で差分を取る。差分なしなら成功、ドリフトがあればレビュアーが分類する"
/>

数式・値のスナップショットを取る基本コマンド（`formulon dump --formulas`、`formulon recalc && formulon dump --values`）は [CI 回帰検査](/ja/runtimes/ci-regression) で説明しているものと同じです。具体的な呼び出し方や、揮発性数式でスナップショットを避けるべき場面についてはそちらを参照してください。このページでは、それらを PR パイプラインに組み込む方法と、ドリフトのレビュー方針を扱います。

push する前のローカルチェックとしては、`make parity-test` が手早い補完手段になります。利用可能なチャネル（`cli`、`npm`（WASM）、`python`）で共有の検証用ワークブックを評価し、チャネル間の不一致を報告します。これも CI ジョブ単体では捉えられない種類のドリフトです。詳しくは [CI 回帰検査](/ja/runtimes/ci-regression#パッケージ間の整合性検査) を参照してください。

## GitHub Actions 例

```yaml
name: workbook regression
on: [pull_request]
jobs:
  workbook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Install formulon CLI
        run: |
          curl -L -o formulon.tar.gz "https://github.com/libraz/formulon/releases/download/v0.10.0/formulon-0.10.0-linux-x64.tar.gz"
          tar -xzf formulon.tar.gz --strip-components=1
          chmod +x formulon
          sudo mv formulon /usr/local/bin/
      - name: Snapshot formulas
        run: |
          formulon dump --formulas model.xlsx > testdata/model.formulas.txt
      - name: Snapshot values
        run: |
          formulon recalc model.xlsx -o /tmp/model.xlsx --quiet
          formulon dump --values /tmp/model.xlsx > testdata/model.values.txt
      - name: Fail on diff
        run: |
          git diff --exit-code testdata/
```

同じワークブック + プロファイル + Formulon バージョンに対して結果は決定論的なので、失敗するのはワークブックかエンジンが変わったときだけです。どちらもレビュー価値があります。

## レビュー方針

差分は次のいずれかに分類してください。

- 想定済みの数式編集
- 想定済みの入力変更
- Formulon の互換性差分
- Excel の挙動変化
- バグ

この分類を PR 本文（またはコミット末尾の注記）に書き残すと、将来同じ差分を見た人が「なぜ受け入れたのか」を追跡できます。期待値ファイルが「ただのバイナリ差分」になるのを防ぎます。

::: tip CI では Formulon バージョンを固定する
dump 出力フォーマットと値の意味はパッチリリース間で安定していますが、Formulon バージョン（または CLI バイナリ URL）を明示的に固定してください。無関係なリリースアップグレードがワークブック回帰として顕在化するのを避けられます。
:::

## 次に読むもの

- [CLI ワークフロー](/ja/runtimes/cli) ─ このシナリオの裏で動くコマンド
- [CI 回帰検査](/ja/runtimes/ci-regression) ─ より広いパターン
- [互換性モデル](/ja/compatibility/model) ─ プロファイルを固定する理由
