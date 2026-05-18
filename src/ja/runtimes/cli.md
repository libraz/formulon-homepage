# CLI ワークフロー

CLI は Formulon の最も軽量な実行入口です。ホスト言語との連携コードを書かずに、シェル・CI・問題再現でスプレッドシート計算を使いたいときに便利です。

::: info 用語: standalone バイナリ
Formulon と最小限のコマンドランナーをリンクした単一実行ファイル。Node / Python / 共有ライブラリは不要です。GitHub Releases から `(os, arch)` 別に配布されます。
:::

主なコマンド:

- `eval`: 名前付きプロファイルで式を評価
- `recalc`: ワークブックを再計算して保存
- `dump`: ワークブック構造や計算値を確認

ホスト言語との連携コードを書く前に CLI で問題を再現できます。

## 例

```sh
formulon --version
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
formulon recalc input.xlsx -o output.xlsx
formulon dump --formulas input.xlsx
formulon dump --values output.xlsx
formulon dump --sheets input.xlsx
formulon dump --metadata input.xlsx
```

::: tip --values は再計算する。--formulas は再計算しない
`dump --values` は表示前に再計算するため、最新結果を見られます。`dump --formulas` と `dump --metadata` は副作用と再計算を避けるためにスキップします。
:::

## CI での使い方

`recalc` と `dump --values` で計算値スナップショットを期待値として保存できます。同じワークブック + プロファイルに対して CLI は決定論的なので、ダンプファイルへの `git diff` が安定したシグナルになります。

```sh
formulon recalc model.xlsx -o /tmp/model.recalc.xlsx --quiet
formulon dump --values /tmp/model.recalc.xlsx > model.values.txt
git diff --exit-code model.values.txt
```

数式だけ追うなら:

```sh
formulon dump --formulas model.xlsx > model.formulas.txt
git diff --exit-code model.formulas.txt
```

キャッシュ値に依存せずに数式編集を検知できます。

::: warning 揮発性関数は決定論的ではない
`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` や一部のネットワーク関数は呼び出すたびに値が変わります。CI スナップショット用の検証データでは避けるか、ワークブック側で固定値に置き換えてください。
:::

## 次に読むもの

- [CLI リファレンス](/ja/api/cli) ─ コマンド構文
- [CI 回帰検査の例](/ja/runtimes/ci-regression) ─ CI gating パターン
- [CI でワークブック回帰検査](/ja/scenarios/ci-regression) ─ パイプライン例
