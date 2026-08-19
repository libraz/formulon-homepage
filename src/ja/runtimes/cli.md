# CLI ワークフロー

CLI は Formulon の最も軽量な実行入口です。ホスト言語との連携コードを書かずに、シェル・CI・問題再現でスプレッドシート計算を使いたいときに便利です。

::: info 用語: standalone バイナリ
Formulon と最小限のコマンドランナーをリンクした単一実行ファイル。Node / Python / 共有ライブラリは不要です。GitHub Releases から `(os, arch)` 別に配布されます。
:::

主なコマンド:

- `eval`: 新規の空ワークブック上で式を評価（`--json` / `--repeat N` に対応）
- `recalc`: ワークブックを再計算して保存
- `dump`: ワークブック構造や計算値を確認
- `paginate`: 1 枚のシートの印刷範囲と改ページを解決

CI では意図しないワークブック変更の検知に、開発時にはホスト言語との連携コードを書く前の問題再現に使えます。

## 例

```sh
formulon --version
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
formulon recalc input.xlsx -o output.xlsx
formulon recalc --threads 4 input.xlsx -o output.xlsx
formulon dump --formulas input.xlsx
formulon dump --values output.xlsx
formulon dump --sheets input.xlsx
formulon dump --metadata input.xlsx
formulon paginate --sheet 0 input.xlsx
```

::: tip --values は再計算する。--formulas は再計算しない
`dump --values` は表示前に再計算するため、最新結果を見られます。`dump --formulas` と `dump --metadata` は再計算をスキップするため、安価で副作用がありません。
:::

## `--` でオプション解析を終える

4 つのコマンドはすべて、`--` でオプション解析を終えられます。コマンドのオプションを `--` より前に置き、その後に位置引数を 1 つだけ渡します。`eval` では数式、`recalc`・`dump`・`paginate` では入力パスを渡します。`-` で始まる相対パスも扱えます。

```sh
formulon dump --sheets -- -input.xlsx
formulon recalc --quiet -o output.xlsx -- -input.xlsx
```

## 出力フォーマットは -o の拡張子で決まる

`recalc` は入力ファイルではなく `-o` の拡張子から保存フォーマットを選びます。`.xlsb` を指定すると MS-XLSB を書き出し、それ以外は OOXML の `.xlsx` を書き出します。

```sh
formulon recalc model.xlsx -o model.xlsb
```

XLSB はスタイル、行 / 列レイアウト、結合、`date1904`、シート表示 / ズーム / 固定ペイン、動的配列メタデータ、対応する tokenized formula をモデル化して出力します。条件付き書式、入力規則、ハイパーリンク、オートフィルター、印刷設定 / 改ページ、drawing / table の参照とリレーションシップはワークシート末尾としてそのまま保持します。保持されることは編集・評価できることを意味しません。[XLSB のカバレッジ](/ja/compatibility/file-format-support) を確認してください。

`recalc` は一時ファイルへ書き込み、成功時だけ対象を置き換えます。失敗しても既存の対象ファイルは壊れません。

`--threads N` を指定しない `recalc` は serial です。並列 SCC scheduler は `0` で最大 8 の自動検出、`1` で worker を起動しない呼び出し側スレッドだけの実行、`2..8` で worker 数の上限を指定します。`0..8` の範囲外は拒否され、要求値より少ない worker 数で完了する場合があります。

コマンドは、復元できなかった数式・定義名、削除された package part、formula cell の downgrade、model 化されなかった feature について loss diagnostics を stderr に警告します。`--quiet` が抑制するのは成功時の status 行だけで、これらの警告は表示されます。

## 反復計算

意図的な循環参照を含むワークブックでは、反復計算を有効にしないと `recalc` はエンジンの非反復循環参照処理がそのまま返す値に収束します。

```sh
formulon recalc circular.xlsx -o circular.xlsx --iterative
```

`--iterative` は反復計算を有効にし、ワークブックに設定された最大反復回数と収束しきい値を保持します。CLI にはこの 2 つのワークブック設定を上書きするフラグがないため、`recalc` の前にワークブック側で設定してください。

## ページ分割

```sh
formulon paginate [--sheet INDEX] <in.xlsx>
```

`INDEX` の既定値は `0` で 0 始まりです。出力は `sheet`、`pages`、両端を含む 0 始まりの `print_area`、`horizontal_breaks`、`vertical_breaks` を示します。成功は `0`、使い方エラーは `64`、エンジン / I/O 失敗は `1` です。

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
- [CI でワークブックの回帰を検出](/ja/scenarios/ci-regression) ─ パイプライン例
