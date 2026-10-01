# CLI ワークフロー

CLI は Formulon の最も軽量な実行入口です。ホスト言語との連携コードを書かずに、シェル・CI・問題再現でスプレッドシート計算を使いたいときに便利です。

::: info 用語: 単体バイナリ
Formulon と最小限のコマンドランナーをリンクした単一実行ファイルです。Node、Python、共有ライブラリは不要です。GitHub Releases から OS / CPU アーキテクチャ別に配布されます。
:::

主なコマンド:

- `eval`: 新規の空ワークブック上で式を評価（`--json` / `--repeat N` に対応）
- `recalc`: ワークブックを再計算して保存
- `dump`: ワークブック構造や計算値を確認
- `paginate`: 1 枚のシートの印刷範囲と改ページを解決

CI では意図しないワークブック変更の検知に、開発時にはホスト言語との連携コードを書く前の問題再現に使えます。

`eval` の数式構文が不正でもセル単位の結果として扱い、`#NAME?` を stdout に出力して終了コード `0` を返します。シェルスクリプトで typo を拒否する場合は終了コードではなく出力値を検査してください。終了コードはホスト側・使い方の失敗を区別するためのものです。

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

XLSB はスタイル、行 / 列レイアウト、結合、`date1904`、シート表示 / ズーム / 固定ペイン、動的配列メタデータ、対応するトークン化された数式をモデル化して出力します。条件付き書式、入力規則、ハイパーリンク、オートフィルター、印刷設定 / 改ページ、描画・テーブルの参照と関連付けは、ワークシート末尾の XML としてそのまま保持します。保持されることは編集・評価できることを意味しません。[XLSB のカバレッジ](/ja/compatibility/file-format-support) を確認してください。

`recalc` は一時ファイルへ書き込み、成功時だけ対象を置き換えます。失敗しても既存の対象ファイルは壊れません。

`--threads N` を指定しない `recalc` はシリアル実行です。並列 SCC スケジューラは `0` で最大 8 の自動検出、`1` でワーカーを起動しない呼び出し側スレッドだけの実行、`2..8` でワーカー数の上限を指定します。`0..8` の範囲外は拒否され、要求値より少ないワーカー数で完了する場合があります。

コマンドは、復元できなかった数式・定義名、削除されたパッケージパート、数式セルのダウングレード、モデル化されなかった機能について保存時の診断を stderr に警告します。`--quiet` が抑制するのは成功時のステータス行だけで、これらの警告は表示されます。

## 反復計算

反復計算が無効な場合、循環参照はエラーとして扱われます。意図的な循環参照を含むワークブックでは `--iterative` を指定してください。

```sh
formulon recalc circular.xlsx -o circular.xlsx --iterative
```

`--iterative` は反復計算を有効にし、ワークブックに設定された最大反復回数と収束しきい値を保持します。CLI にはこの 2 つのワークブック設定を上書きするフラグがないため、`recalc` の前にワークブック側で設定してください。

## ページ分割

```sh
formulon paginate [--sheet INDEX] <in.xlsx>
```

`INDEX` の既定値は `0` で 0 始まりです。出力は `sheet`、`pages`、両端を含む 0 始まりの `print_area`、`horizontal_breaks`、`vertical_breaks` を示します。成功は `0`、使い方エラーは `64`、エンジン / I/O 失敗は `1` です。改ページがない場合、対応する配列は空になります。

## CI での使い方

`dump --values` で計算値スナップショットを作成し、先にコミットした期待値ファイルと比較できます。期待値ファイルを作成してコミットし、未追跡ファイルを `git diff` が比較しないことに注意してください。揮発性の入力を固定し、エンジンのバージョンとプロファイルをそろえると、ダンプの `git diff` からワークブックやエンジンの変更を確認できます。

```sh
formulon dump --values model.xlsx > model.values.txt
git diff --exit-code model.values.txt
```

数式だけ追うなら:

```sh
formulon dump --formulas model.xlsx > model.formulas.txt
git diff --exit-code model.formulas.txt
```

キャッシュ値に依存せずに数式編集を検知できます。

::: warning 揮発性関数は決定論的ではない
`NOW` / `TODAY` / `RAND` / `RANDBETWEEN` は揮発性関数です。`WEBSERVICE`、CUBE 関数、`STOCKHISTORY` など外部サービス依存の関数はネットワークへアクセスせず、利用不可を表す固定の Excel エラーを返します。揮発性の入力を固定または置き換え、外部サービス依存のセルは [数式カバレッジ](/ja/compatibility/formula-coverage) に従って記録するか、スナップショットから除外してください。
:::

## 次に読むもの

- [CLI リファレンス](/ja/api/cli) ─ コマンド構文
- [CI 回帰検査の例](/ja/runtimes/ci-regression) ─ CI の判定パターン
- [CI でワークブックの回帰を検出](/ja/scenarios/ci-regression) ─ パイプライン例
