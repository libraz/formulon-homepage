# CLI ワークフロー

`formulon` コマンドを使うと、ホスト言語の連携コードを書かずに、シェルスクリプト、CI ジョブ、問題の再現でエンジンを動かせます。

## インストールと最初の実行

```sh
curl -LO https://github.com/libraz/formulon/releases/download/v0.18.0/formulon-0.18.0-linux-x64.tar.gz
tar -xzf formulon-0.18.0-linux-x64.tar.gz
./formulon-0.18.0-linux-x64/formulon eval '=SUM(1,2,3)'   # 6
```

アーカイブは `linux-x64`、`linux-arm64`、`darwin-arm64` 向けがあり、それぞれ `.sha256` ファイルが付いています。以下のコマンドをそのまま使うには、`formulon` バイナリを `PATH` の通った場所に置いてください。

::: info 用語: 単体バイナリ
エンジンと依存ライブラリをリンク済みの実行ファイル 1 つです。Node、Python、Formulon の共有ライブラリは不要で、必要なのは OS の C / C++ ランタイムライブラリだけです。
:::

コマンドは次の 4 つです。

- `eval`: 新規の空ワークブックで数式を 1 つ評価する
- `recalc`: ワークブックを再計算し、結果を新しいファイルに書き出す
- `dump`: 数式、値、シート名、メタデータを差分を取りやすい形で出力する
- `paginate`: 1 枚のシートの印刷範囲と改ページを解決する

どのコマンドも `--profile ID`（既定値は `win-365-en_US`）と `--now DATE` を受け付けます。`--now` はその実行に限り `NOW()`、`TODAY()`、相対日付フィルターの時刻を固定します。どちらもファイルには保存されません。CI では両方を指定し、ランナーのロケールや時計に結果が左右されないようにしてください。

`eval` は数式の打ち間違いもセル単位の結果として扱い、`#NAME?` を出力して `0` で終了します。終了コードが知らせるのは使い方とホスト側の失敗だけなので、打ち間違いを拒否したいスクリプトは出力を確認してください。すべてのフラグ、出力形式、終了コードは [CLI リファレンス](/ja/api/cli) にあります。

## 例

```sh
formulon --version
formulon eval --json '=1/0'                 # {"kind":"error","value":"#DIV/0!"}
formulon recalc --profile win-365-en_US --now 2026-10-09T09:30:00 input.xlsx -o output.xlsx
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

XLSB に書き出すと、XLSX なら保持できる機能が失われたり保留されたりする場合があります。`recalc` は損失を stderr に報告します（[損失の警告](/ja/api/cli#loss-warnings)）。保持できる範囲は [ファイル形式サポート](/ja/compatibility/file-format-support) を参照してください。書き込みはアトミックなので、読み込み、再計算、保存のどこで失敗しても既存の出力先ファイルは変わりません。

入力ファイルに保存された不正な数式は読み込めます。再計算後は `#NAME?` のセルになり、コマンドは失敗しません。

`recalc` は `--threads N` を指定しない限り直列に実行します（`0` は自動検出、`1` は呼び出し元スレッドだけ、`2..8` はワーカー数の上限）。

## 反復計算

意図的な循環参照を含むワークブックでは反復計算が必要です。指定しない場合、`recalc` は [再計算](/ja/workbook/recalculation) にある反復なしの規則で循環を処理します。

```sh
formulon recalc circular.xlsx -o circular.xlsx --iterative
```

`--iterative` は反復計算を有効にし、ワークブックに設定された最大反復回数と収束しきい値を保持します。CLI にはこの 2 つのワークブック設定を上書きするフラグがないため、`recalc` の前にワークブック側で設定してください。

## CI での使い方

`dump --values` と `dump --formulas` は安定したテキストを出力するため、コミット済みの期待値ファイルと差分を取れます。スナップショットの準備と、揮発性関数や外部サービス依存の関数の扱いは [CI でワークブックの回帰を検出](/ja/scenarios/ci-regression) を参照してください。

## 次に読むもの

- [CLI リファレンス](/ja/api/cli) ─ コマンド構文
- [CI でワークブックの回帰を検出](/ja/scenarios/ci-regression) ─ スナップショット、GitHub Actions の例、レビュー方針
- [CI でワークブックの回帰を検出](/ja/scenarios/ci-regression) ─ パイプライン例
